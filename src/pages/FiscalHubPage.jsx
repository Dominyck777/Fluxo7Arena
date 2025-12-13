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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateNfcePayloadPreview } from '@/lib/fiscal-mapper';
import { listarTotaisPorComanda, listMesas, listarClientesPorComandas, listarFinalizadorasPorComandas, listarItensDaComanda, listarClientes, listarFinalizadoras } from '@/lib/store';
import { enviarNfce, consultarEmissaoNfce, cancelarNfce, getTransmiteNotaConfigFromEmpresa } from '@/lib/transmitenota';
import { Settings, Search, Trash2, X, FileText } from 'lucide-react';
import { gerarXMLNFe, gerarXMLNFeFromData } from '@/lib/nfe';
import { listProducts } from '@/lib/products';
import cfopList from '@/data/cfop.json';
import { listSuppliers } from '@/lib/suppliers';
import { FORCE_MAINTENANCE } from '@/lib/maintenanceConfig';

function fmtMoney(v) { const n = Number(v||0); return n.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(iso){ if(!iso) return '—'; try{ const d=new Date(iso); return d.toLocaleString('pt-BR'); }catch{return '—';} }
function fmtDoc(doc){ const d=String(doc||'').replace(/\D/g,''); if(d.length===11){ return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'); } if(d.length===14){ return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'); } return doc||''; }

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
    const width = 320; // approx calendar width
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const top = Math.min(r.bottom + 6, window.innerHeight - 8 - 300); // ensure visible
    setPos({ top, left });
  }, []);

  React.useEffect(()=>{
    const onDoc = (e)=>{ if (open && wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  },[open]);
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
        <div className="fixed z-[1000] p-2 bg-black text-white border border-warning/40 rounded-md shadow-xl" style={{ top: pos.top, left: pos.left }}>
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
  const [tab, setTab] = useState('nfce');

  // Maintenance overlay (specific for Central Fiscal)
  const [maintActive, setMaintActive] = useState(false);
  const [maintBypass, setMaintBypass] = useState(false);
  useEffect(() => {
    try {
      const env = String(import.meta.env.VITE_MAINTENANCE_MODE || '').toLowerCase() === 'true';
      const isActiveLS = localStorage.getItem('maintenance:active') === 'true';
      const end = localStorage.getItem('maintenance:end');
      const expired = end ? (new Date() > new Date(end)) : false;
      const activeNow = (Boolean(FORCE_MAINTENANCE) || env || isActiveLS) && !expired;
      const bypass = (() => {
        try {
          const ls = localStorage.getItem('maintenance:bypass') === '1';
          const ss = sessionStorage.getItem('maintenance:bypass') === '1';
          const ck = document.cookie.split(';').some(c => c.trim() === 'fx_maint_bypass=1');
          return ls || ss || ck;
        } catch { return false; }
      })();
      setMaintActive(activeNow);
      setMaintBypass(bypass);
    } catch {
      setMaintActive(Boolean(FORCE_MAINTENANCE));
      setMaintBypass(false);
    }
  }, []);

  const [preOpen, setPreOpen] = useState(false);
  const [preLoading, setPreLoading] = useState(false);
  const [prePayload, setPrePayload] = useState(null);
  const [preMissing, setPreMissing] = useState([]);
  const [empresaMissing, setEmpresaMissing] = useState([]);

  const [nfeOpen, setNfeOpen] = useState(false);
  const [nfeGenerating, setNfeGenerating] = useState(false);
  const [nfeXml, setNfeXml] = useState('');
  const [nfeComandaId, setNfeComandaId] = useState(null);
  const [nfeForm, setNfeForm] = useState({ natOp: 'VENDA', serie: '1', nNF: '', indFinal: '1', indPres: '1', idDest: '' });
  const [nfeSaving, setNfeSaving] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualXml, setManualXml] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const [manualForm, setManualForm] = useState({
    natOp: 'VENDA', serie: '1', nNF: '', indFinal: '1', indPres: '1', idDest: '',
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
    pagamentos: [ { tipo: 'Dinheiro', bandeira: '', cnpj_credenciadora: '', valor: '', parcelas: '', troco: '' } ],
    transporte: { tipo_frete: '', transportadora: '', placa: '', volumes: '', peso_liquido: '', peso_bruto: '' },
    adicionais: { obs_gerais: '', info_fisco: '', info_cliente: '', referencia_doc: '' },
  });
  const [manualTab, setManualTab] = useState('cliente');
  const [manualCepLoading, setManualCepLoading] = useState(false);
  const [empresaUF, setEmpresaUF] = useState('');
  const [products, setProducts] = useState([]);
  const [productFilter, setProductFilter] = useState('');
  const [pickerIndex, setPickerIndex] = useState(null); // legacy (não usado mais para inline)
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productPickerTarget, setProductPickerTarget] = useState(null);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [partyQuickOpen, setPartyQuickOpen] = useState(false);
  const [partyQuery, setPartyQuery] = useState('');
  const [partyList, setPartyList] = useState([]);
  const [partyModalTipo, setPartyModalTipo] = useState('cliente'); // 'cliente' | 'fornecedor'
  const [payMethods, setPayMethods] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);
  const [cfopFilter, setCfopFilter] = useState('');
  const [xmlPreviewOpen, setXmlPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importComandaId, setImportComandaId] = useState('');
  const [autoApplyCfop, setAutoApplyCfop] = useState(true);

  const onlyDigits = (v) => String(v||'').replace(/\D/g, '');
  const parseDec = (v) => {
    const s = String(v ?? '').replace(/\./g,'').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  // Ajusta baixar_estoque conforme tipo da nota (Saída:true, Entrada:false)
  useEffect(() => {
    setManualForm(f => ({ ...f, baixar_estoque: f.tipo_nota !== 'entrada' }));
  }, [manualForm.tipo_nota]);

  useEffect(() => {
    setManualForm(f => ({ ...f, cfop_padrao: autoChooseCfop(f.uf) }));
  }, [manualForm.tipo_nota, empresaUF, manualForm.uf]);

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
    setExpandedItem(expandedItem===idx? null : idx);
  };
  const moneyMaskBR = (value) => {
    const digits = String(value||'').replace(/\D/g,'');
    if (!digits) return '';
    const int = digits.slice(0, Math.max(1, digits.length-2));
    const dec = digits.slice(-2).padStart(2,'0');
    const intFmt = Number(int).toLocaleString('pt-BR');
    return `${intFmt},${dec}`;
  };

  const importFromComanda = async () => {
    try {
      if (!importComandaId) { toast({ title: 'Selecione uma comanda para importar', variant: 'warning' }); return; }
      const itens = await listarItensDaComanda({ comandaId: importComandaId, codigoEmpresa });
      const mapped = (itens || []).map((it) => {
        const p = (products || []).find(pp => String(pp.id) === String(it.produto_id));
        const cfop = p?.cfopInterno || p?.cfopExterno || autoChooseCfop(manualForm.uf);
        const unidade = (p?.unit || 'UN').toString().toUpperCase();
        const preco = Number(it.preco_unitario || 0) || 0;
        const pisCst = (p?.cstPisSaida) || ((p?.aliqPisPercent ?? null) != null ? '01' : '');
        const cofinsCst = ((p?.aliqCofinsPercent ?? null) != null ? '01' : '');
        return {
          descricao: it.descricao || p?.name || 'Item',
          codigo: p?.code || '',
          ncm: p?.ncm || '',
          cest: p?.cest || '',
          cfop: cfop || '5102',
          unidade,
          quantidade: String(Number(it.quantidade || 1)),
          preco_unitario: preco.toFixed(2),
          desconto_valor: '0.00',
          desconto_percent: '',
          acrescimos_valor: '0.00',
          obs: '',
          impostos: {
            origem: '',
            icms: { cst: p?.cstIcmsInterno || '', csosn: p?.csosnInterno || '', base: '', aliquota: p?.aliqIcmsInterno != null ? String(p.aliqIcmsInterno) : '', valor: '' },
            icmsst: { base: '', aliquota: '', valor: '' },
            pis: { cst: pisCst, aliquota: p?.aliqPisPercent != null ? String(p.aliqPisPercent) : '', valor: '' },
            cofins: { cst: cofinsCst, aliquota: p?.aliqCofinsPercent != null ? String(p.aliqCofinsPercent) : '', valor: '' },
            ipi: { cst: p?.cstIpi || '', aliquota: p?.aliqIpiPercent != null ? String(p.aliqIpiPercent) : '', valor: '' },
            iss: { aliquota: '', valor: '' },
          },
        };
      });
      if (!mapped.length) { toast({ title: 'Nenhum item encontrado nesta comanda', variant: 'warning' }); return; }
      setManualForm(f => ({ ...f, itens: mapped }));
      setImportOpen(false);
      toast({ title: 'Itens importados' });
    } catch (e) {
      toast({ title: 'Falha ao importar itens', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
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
    if (!t) return products.slice(0, 100);
    return products.filter(p => (p.name||'').toLowerCase().includes(t) || (p.code||'').toLowerCase().includes(t)).slice(0, 100);
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
      if (!partyPickerOpen) return;
      try {
        if (partyModalTipo === 'fornecedor') {
          const data = await listSuppliers(codigoEmpresa);
          if (alive) setPartyList(data || []);
        } else {
          const data = await listarClientes({ searchTerm: partyQuery, limit: 50, codigoEmpresa });
          if (alive) setPartyList(data || []);
        }
      } catch { if (alive) setPartyList([]); }
    }
    loadParties();
    return () => { alive = false; };
  }, [partyPickerOpen, partyQuery, partyModalTipo, codigoEmpresa]);

  const filteredPartyList = useMemo(() => {
    const t = (partyQuery||'').trim().toLowerCase();
    if (!t) return partyList || [];
    return (partyList||[]).filter(p => {
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
      parte_tipo: partyModalTipo,
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
  // Carregar finalizadoras quando abrir a aba Pagamento
  useEffect(() => {
    let alive = true;
    async function loadFins(){
      if (!manualOpen || manualTab !== 'pagamento') return;
      try {
        const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa });
        if (alive) setPayMethods(Array.isArray(fins) ? fins : []);
      } catch { if (alive) setPayMethods([]); }
    }
    loadFins();
    return () => { alive = false; };
  }, [manualOpen, manualTab, codigoEmpresa]);
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
      const xml = await gerarXMLNFe({ comandaId: nfeComandaId, codigoEmpresa, modelo: '55', overrides: nfeForm });
      setNfeXml(xml);
      toast({ title: 'XML NF-e gerado' });
    } catch (e) {
      toast({ title: 'Falha ao gerar XML', description: e.message, variant: 'destructive' });
    } finally { setNfeGenerating(false); }
  };

  const saveNfeXml = async () => {
    if (!nfeXml || !nfeComandaId) return;
    try {
      setNfeSaving(true);
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
        });
      } catch {}
      toast({ title: 'XML salvo', description: url ? 'Link público gerado.' : 'Arquivo salvo no Storage.' });
      await load();
    } catch (e) {
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
    <div className="relative p-4">
      <Helmet><title>Central Fiscal</title></Helmet>
      {true && (
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
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Central Fiscal</h1>
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

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="nfce">NFC-e</TabsTrigger>
          <TabsTrigger value="nfe">NF-e</TabsTrigger>
        </TabsList>

        <TabsContent value="nfce">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Buscar</Label>
              <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Chave, número..." className="w-60" />
            </div>
            <Label className="text-sm ml-1">Status</Label>
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
        </TabsContent>

        <TabsContent value="nfe">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Buscar</Label>
              <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Chave, número..." className="w-60" />
            </div>
            <Label className="text-sm ml-1">Status</Label>
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
            <div className="ml-auto">
              <Button size="sm" onClick={()=>{ setManualXml(''); setManualOpen(true); }}>Nova NF-e</Button>
            </div>
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
                        <Button size="sm" onClick={()=>openNfe(r.id)}>Gerar XML NF-e</Button>
                        <Button size="sm" variant="outline" disabled>Emitir via API (em breve)</Button>
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
        </TabsContent>
      </Tabs>

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

      {/* Party Picker Modal (Cliente/Fornecedor) */}
      <Dialog open={partyPickerOpen} onOpenChange={setPartyPickerOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar {partyModalTipo==='fornecedor'?'fornecedor':'cliente'}</DialogTitle>
            <DialogDescription>Busque pelo código, nome ou documento e escolha a parte.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <Button size="sm" variant={partyModalTipo==='cliente'?'default':'outline'} onClick={()=>setPartyModalTipo('cliente')}>Clientes</Button>
              <Button size="sm" variant={partyModalTipo==='fornecedor'?'default':'outline'} onClick={()=>setPartyModalTipo('fornecedor')}>Fornecedores</Button>
            </div>
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
              <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-surface-2 cursor-pointer" onClick={()=>{ if (productPickerTarget!=null) applyProductToItem(productPickerTarget, p); setProductPickerOpen(false); }}>
                <div className="text-sm">{p.name} <span className="text-text-secondary">{p.code ? `(${p.code})` : ''}</span></div>
                <div className="text-xs text-text-secondary">NCM {p.ncm || '—'} • UN {String(p.unit||'UN').toUpperCase()} • R$ {fmtMoney(p.price ?? p.salePrice ?? 0)}</div>
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

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="w-[960px] max-w-[96vw] h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Criar NF-e (manual)</DialogTitle>
            <DialogDescription>Preencha os dados nas abas para gerar o XML.</DialogDescription>
          </DialogHeader>
          <Tabs value={manualTab} onValueChange={setManualTab} className="w-full flex-1 overflow-hidden flex flex-col">
            <TabsList className="mb-3 w-full flex flex-wrap justify-start gap-1">
              <TabsTrigger value="cliente">Cabeçalho</TabsTrigger>
              <TabsTrigger value="itens">Produtos</TabsTrigger>
              <TabsTrigger value="impostos">Impostos</TabsTrigger>
              <TabsTrigger value="totais">Totais</TabsTrigger>
              <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
              <TabsTrigger value="transporte">Transporte</TabsTrigger>
              <TabsTrigger value="adicionais">Informações</TabsTrigger>
              <TabsTrigger value="rastreabilidade">Rastreabilidade</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto pr-1">
            {manualTab === 'cliente' && (<>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div>
                <Label>Tipo da Nota</Label>
                <Select value={manualForm.tipo_nota} onValueChange={(v)=>setManualForm(f=>({...f, tipo_nota:v, natOp: v==='entrada' ? 'COMPRA' : (f.natOp||'VENDA')}))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{manualForm.tipo_nota==='entrada' ? 'Fornecedor' : 'Cliente'} (código)</Label>
                <div className="flex items-center gap-1">
                  <Input className="h-9 w-[110px]" inputMode="numeric" value={manualForm.party_codigo} onChange={(e)=>setManualForm(f=>({...f, party_codigo: e.target.value.replace(/\D/g,'')}))} onKeyDown={(e)=>{ if (e.key==='Enter') { e.preventDefault(); findPartyByCode(manualForm.party_codigo); } }} onBlur={()=>findPartyByCode(manualForm.party_codigo)} placeholder="—" />
                  <Button type="button" size="icon" variant="ghost" title="Selecionar" onClick={()=>{ setPartyQuery(''); setPartyModalTipo(manualForm.tipo_nota==='entrada' ? 'fornecedor' : 'cliente'); setPartyPickerOpen(true); }}>
                    <Search className="h-4 w-4" />
                  </Button>
                  { (manualForm.party_codigo || manualForm.nome || manualForm.cpf_cnpj) && (
                    <Button type="button" size="icon" variant="ghost" title="Limpar" onClick={()=>setManualForm(f=>({
                      ...f,
                      party_id:'', party_codigo:'',
                      tipo_pessoa:'PJ', cpf_cnpj:'', nome:'', email:'', telefone:'',
                      inscricao_estadual:'', ie_isento:false,
                      logradouro:'', numero:'', bairro:'', cidade:'', uf:'', cep:'', codigo_municipio_ibge:''
                    }))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>Data Emissão</Label>
                <DateInput label="Data Emissão" value={manualForm.data_emissao} onChange={(v)=>setManualForm(f=>({...f, data_emissao:v}))} />
              </div>
              <div>
                <Label>Data Saída</Label>
                <DateInput label="Data Saída" value={manualForm.data_saida} onChange={(v)=>setManualForm(f=>({...f, data_saida:v}))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <div>
                <Label>Natureza (natOp)</Label>
                <Input className="h-8" list="natop-list" value={manualForm.natOp} onChange={(e)=>setManualForm(f=>({...f, natOp: e.target.value}))} />
              </div>
              <div>
                <Label>Série</Label>
                <Input className="h-8" value={manualForm.serie} onChange={(e)=>setManualForm(f=>({...f, serie: e.target.value}))} />
              </div>
              <div>
                <Label>Número (nNF)</Label>
                <Input className="h-8" value={manualForm.nNF} onChange={(e)=>setManualForm(f=>({...f, nNF: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <div>
                <Label>Finalidade da NF</Label>
                <Select value={manualForm.finNFe} onValueChange={(v)=>setManualForm(f=>({...f, finNFe:v}))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Normal</SelectItem>
                    <SelectItem value="2">Complementar</SelectItem>
                    <SelectItem value="3">Ajuste</SelectItem>
                    <SelectItem value="4">Devolução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Local de Destino</Label>
                <Select value={manualForm.idDest} onValueChange={(v)=>setManualForm(f=>({...f, idDest:v}))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Operação Interna</SelectItem>
                    <SelectItem value="2">Interestadual</SelectItem>
                    <SelectItem value="3">Exterior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div>
                <Label>Indicador de presença</Label>
                <Select value={manualForm.indPres} onValueChange={(v)=>setManualForm(f=>({...f, indPres:v}))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Não se aplica</SelectItem>
                    <SelectItem value="1">Operação presencial</SelectItem>
                    <SelectItem value="2">Não presencial (internet)</SelectItem>
                    <SelectItem value="3">Não presencial (teleatendimento)</SelectItem>
                    <SelectItem value="4">Entrega a domicílio</SelectItem>
                    <SelectItem value="9">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Intermediador/Marketplace</Label>
                <Select value={manualForm.indIntermed} onValueChange={(v)=>setManualForm(f=>({...f, indIntermed:v}))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sem intermediador</SelectItem>
                    <SelectItem value="1">Com intermediador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={manualForm.indFinal==='1'} onCheckedChange={(v)=>setManualForm(f=>({...f, indFinal: v? '1':'0'}))} />
                <span className="text-sm">Consumidor Final</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={!!manualForm.baixar_estoque} onCheckedChange={(v)=>setManualForm(f=>({...f, baixar_estoque: !!v}))} />
                <span className="text-sm">Baixar Estoque</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={!!manualForm.destacar_st} onCheckedChange={(v)=>setManualForm(f=>({...f, destacar_st: !!v}))} />
                <span className="text-sm">Destacar Substituição Trib.</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="autoApplyCfop" checked={!!autoApplyCfop} onCheckedChange={(v)=>setAutoApplyCfop(!!v)} />
                <Label htmlFor="autoApplyCfop" className="text-xs">Aplicar CFOP padrão automaticamente aos itens</Label>
              </div>
            </div>

            {manualForm.indIntermed === '1' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <div>
                  <Label>CNPJ Intermediador</Label>
                  <Input inputMode="numeric" placeholder="Somente números" value={manualForm.intermediador_cnpj} onChange={(e)=>setManualForm(f=>({...f, intermediador_cnpj: onlyDigits(e.target.value)}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Identificador no Intermediador</Label>
                  <Input value={manualForm.intermediador_id} onChange={(e)=>setManualForm(f=>({...f, intermediador_id: e.target.value}))} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div className="md:col-span-2">
                <Label>CFOP padrão</Label>
                <Select value={manualForm.cfop_padrao || ''} onValueChange={(v)=>{ setCfopFilter(''); setManualForm(f=>({...f, cfop_padrao:v, natOp: natFromCfop(v)})); }}>
                  <SelectTrigger className="mt-1 w-full truncate h-8 text-xs">
                    <SelectValue placeholder="Selecionar CFOP" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-auto w-[360px] sm:w-[420px]">
                    <div className="sticky top-0 z-10 p-2 bg-background">
                      <Input className="h-8 text-xs" placeholder="Filtrar CFOP ou descrição" value={cfopFilter} onChange={(e)=>setCfopFilter(e.target.value)} />
                    </div>
                    {CFOP_CATALOG.filter(opt => {
                      const t = cfopFilter.trim().toLowerCase();
                      if (!t) return true;
                      return opt.code.toLowerCase().includes(t) || (opt.desc||'').toLowerCase().includes(t);
                    }).map(opt => (
                      <SelectItem key={opt.code} value={opt.code} title={`${opt.code} — ${opt.desc}`}>{`${opt.code} - ${(opt.desc||'').slice(0,60)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            </>)}


            <TabsContent value="cliente">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Tipo pessoa</Label>
                  <Select value={manualForm.tipo_pessoa} onValueChange={(v)=>setManualForm(f=>({...f, tipo_pessoa: v}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PJ">PJ</SelectItem>
                      <SelectItem value="PF">PF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CPF/CNPJ</Label>
                  <Input inputMode="numeric" placeholder="Somente números" value={manualForm.cpf_cnpj} onChange={(e)=>setManualForm(f=>({...f, cpf_cnpj: onlyDigits(e.target.value)}))} />
                </div>
                <div>
                  <Label>Nome/Razão</Label>
                  <Input value={manualForm.nome} onChange={(e)=>setManualForm(f=>({...f, nome: e.target.value}))} />
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={manualForm.inscricao_estadual} onChange={(e)=>setManualForm(f=>({...f, inscricao_estadual: e.target.value}))} disabled={manualForm.ie_isento} />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Checkbox checked={manualForm.ie_isento} onCheckedChange={(v)=>setManualForm(f=>({...f, ie_isento: !!v, inscricao_estadual: v? 'ISENTO' : f.inscricao_estadual}))} />
                  <span className="text-sm">IE Isento</span>
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input inputMode="numeric" placeholder="(DD) 9XXXX-XXXX" value={manualForm.telefone} onChange={(e)=>setManualForm(f=>({...f, telefone: onlyDigits(e.target.value)}))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={manualForm.email} onChange={(e)=>setManualForm(f=>({...f, email: e.target.value}))} />
                </div>
                <div>
                  <Label>Logradouro</Label>
                  <Input value={manualForm.logradouro} onChange={(e)=>setManualForm(f=>({...f, logradouro: e.target.value}))} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={manualForm.numero} onChange={(e)=>setManualForm(f=>({...f, numero: e.target.value}))} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={manualForm.bairro} onChange={(e)=>setManualForm(f=>({...f, bairro: e.target.value}))} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={manualForm.cidade} onChange={(e)=>setManualForm(f=>({...f, cidade: e.target.value}))} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={manualForm.uf} onChange={(e)=>setManualForm(f=>({...f, uf: e.target.value.toUpperCase().slice(0,2)}))} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input inputMode="numeric" placeholder="00000000" value={manualForm.cep} onChange={(e)=>setManualForm(f=>({...f, cep: onlyDigits(e.target.value).slice(0,8)}))} onBlur={()=>lookupCep(manualForm.cep)} />
                  {manualCepLoading && (<div className="text-xs text-text-secondary mt-1">Buscando endereço…</div>)}
                </div>
                <div>
                  <Label>cMun IBGE</Label>
                  <Input inputMode="numeric" placeholder="Código do município (IBGE)" value={manualForm.codigo_municipio_ibge} onChange={(e)=>setManualForm(f=>({...f, codigo_municipio_ibge: onlyDigits(e.target.value)}))} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="itens">
              <div className="space-y-2">
                {manualForm.itens.map((it, idx) => (
                  <div key={idx} className="space-y-1 border border-border rounded-md p-2" onClick={handleItemClick(idx)}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-1 items-start">
                      <div className="md:col-span-2">
                        <Label>Código</Label>
                        <Input className="h-8 text-xs" value={it.codigo}
                          onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], codigo:e.target.value}; return {...f, itens:a}; })}
                          onKeyDown={(e)=>{ if(e.key==='Enter'){ const p=(products||[]).find(pp=>String(pp.code||'')===String((it.codigo||'').trim())); if(p) applyProductToItem(idx,p); }} }
                          onBlur={()=>{ const p=(products||[]).find(pp=>String(pp.code||'')===String((it.codigo||'').trim())); if(p) applyProductToItem(idx,p); }}
                        />
                      </div>
                      <div className="md:col-span-3 min-w-0">
                        <Label>Descrição</Label>
                        <div className="flex items-center gap-1">
                          <Input className="h-8 text-xs flex-1" value={it.descricao} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], descricao:e.target.value}; return {...f, itens:a}; })} />
                          <Button type="button" size="icon" variant="ghost" title="Buscar produto" onClick={()=>{ setProductPickerTarget(idx); setProductFilter(''); setProductPickerOpen(true); }}>
                            <Search className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="text-text-secondary hover:text-red-500" title="Remover item" onClick={()=>setManualForm(f=>({ ...f, itens: f.itens.filter((_,i)=>i!==idx) }))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <Label>CFOP</Label>
                        <Select value={it.cfop || ''} onValueChange={(v)=>{ setCfopFilter(''); setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], cfop:v}; return { ...f, itens:a, natOp: natFromCfop(v) }; }); }}>
                          <SelectTrigger className="mt-1 w-full truncate h-8 text-xs">
                            <SelectValue placeholder="Selecionar CFOP" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] overflow-auto w-[360px] sm:w-[420px]">
                            <div className="sticky top-0 z-10 p-2 bg-background">
                              <Input className="h-8 text-xs" placeholder="Filtrar CFOP ou descrição" value={cfopFilter} onChange={(e)=>setCfopFilter(e.target.value)} />
                            </div>
                            {CFOP_CATALOG.filter(opt => {
                              const t = cfopFilter.trim().toLowerCase();
                              if (!t) return true;
                              return opt.code.toLowerCase().includes(t) || (opt.desc||'').toLowerCase().includes(t);
                            }).map(opt => (
                              <SelectItem key={opt.code} value={opt.code} title={`${opt.code} — ${opt.desc}`}>{`${opt.code} - ${(opt.desc||'').slice(0,60)}`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-1">
                        <Label>Unid.</Label>
                        <Input className="h-8 text-xs" list="unid-list" placeholder="UN, KG, LT…" value={it.unidade} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], unidade:e.target.value.toUpperCase().slice(0,5)}; return {...f, itens:a}; })} />
                      </div>
                      <div className="md:col-span-1">
                        <Label>Cód. Barras</Label>
                        <Input className="h-8 text-xs" value={it.cod_barras||''}
                          onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], cod_barras:e.target.value}; return {...f, itens:a}; })}
                          onKeyDown={(e)=>{ if(e.key==='Enter'){ const v=String((it.cod_barras||'').trim()); const p=(products||[]).find(pp=>[pp.barcode, pp.ean, pp.gtin, pp.bar_code].some(x=>String(x||'')===v)); if(p) applyProductToItem(idx,p); }} }
                          onBlur={()=>{ const v=String((it.cod_barras||'').trim()); const p=(products||[]).find(pp=>[pp.barcode, pp.ean, pp.gtin, pp.bar_code].some(x=>String(x||'')===v)); if(p) applyProductToItem(idx,p); }}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Label>Qtd</Label>
                        <Input className="h-8 text-xs" inputMode="decimal" value={it.quantidade} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], quantidade:e.target.value.replace(/[^0-9.,]/g,'')}; return {...f, itens:a}; })} />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Preço</Label>
                        <Input className="h-8 text-xs" inputMode="decimal" value={it.preco_unitario} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], preco_unitario: moneyMaskBR(e.target.value)}; return {...f, itens:a}; })} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-secondary mt-1">
                      <div className="truncate">{`Item ${idx+1}: ${it.codigo ? it.codigo + ' - ' : ''}${it.descricao || '—'}`}</div>
                      <div>{`Total item: R$ ${fmtMoney(((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)) - ((parseDec(it.desconto_percent)||0) ? ((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)*(parseDec(it.desconto_percent)||0)/100) : (parseDec(it.desconto_valor)||0)) + (parseDec(it.acrescimos_valor)||0) + (parseDec(it.frete_valor)||0) + (parseDec(it.seguro_valor)||0))}`}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={!!it.dest_icms} onCheckedChange={(v)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], dest_icms: !!v}; return {...f, itens:a}; })} />
                        <span className="text-xs">Destacar ICMS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={!!it.dest_icms_info} onCheckedChange={(v)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], dest_icms_info: !!v}; return {...f, itens:a}; })} />
                        <span className="text-xs">ICMS na Info. Adicional</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={!!it.benef_fiscal} onCheckedChange={(v)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], benef_fiscal: !!v}; return {...f, itens:a}; })} />
                        <span className="text-xs">Benefício Fiscal</span>
                      </div>
                    </div>
                    {expandedItem===idx && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-12 gap-1">
                        <div className="md:col-span-2">
                          <Label>NCM</Label>
                          <Input className="h-8 text-xs" inputMode="numeric" placeholder="8 dígitos" value={it.ncm} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], ncm: onlyDigits(e.target.value).slice(0,8)}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-2">
                          <Label>CEST</Label>
                          <Input className="h-8 text-xs" value={it.cest || ''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], cest:e.target.value}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Desc. (R$)</Label>
                          <Input className="h-8 text-xs" inputMode="decimal" value={it.desconto_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], desconto_valor: moneyMaskBR(e.target.value)}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Desc. (%)</Label>
                          <Input className="h-8 text-xs" inputMode="decimal" value={it.desconto_percent||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], desconto_percent:e.target.value.replace(/[^0-9.,]/g,'')}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Acréscimos</Label>
                          <Input className="h-8 text-xs" inputMode="decimal" value={it.acrescimos_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], acrescimos_valor: moneyMaskBR(e.target.value)}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Frete (R$)</Label>
                          <Input className="h-8 text-xs" inputMode="decimal" value={it.frete_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], frete_valor: moneyMaskBR(e.target.value)}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Seguro (R$)</Label>
                          <Input className="h-8 text-xs" inputMode="decimal" value={it.seguro_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], seguro_valor: moneyMaskBR(e.target.value)}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-12">
                          <Label>Observações</Label>
                          <Input className="h-8 text-xs" value={it.obs||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], obs:e.target.value}; return {...f, itens:a}; })} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-start">
                  <Button size="sm" variant="outline" onClick={()=>{
                    setManualForm(f=>{
                      const novo={ descricao:'', codigo:'', cod_barras:'', ncm:'', cest:'', cfop: f.cfop_padrao || '5102', unidade:'UN', quantidade:'1', preco_unitario:'0.00', desconto_valor:'0.00', desconto_percent:'', acrescimos_valor:'0.00', frete_valor:'0.00', seguro_valor:'0.00', obs:'', dest_icms:false, dest_icms_info:false, benef_fiscal:false, impostos:{ origem:'', icms:{ cst:'', csosn:'', base:'', aliquota:'', valor:'', desonerado_valor:'', desoneracao_motivo:'', operacao_valor:'', aliq_diferimento:'', valor_diferido:'' }, icmsst:{ base:'', aliquota:'', valor:'' }, fcp:{ base:'', aliquota:'', valor:'' }, fcpst:{ base:'', aliquota:'', valor:'' }, pis:{ cst:'', aliquota:'', valor:'' }, cofins:{ cst:'', aliquota:'', valor:'' }, ipi:{ cst:'', aliquota:'', valor:'', tipo_calculo:'nenhum', valor_unit:'' }, iss:{ aliquota:'', valor:'' } } };
                      return { ...f, itens:[...f.itens, novo] };
                    });
                  }}>Adicionar item</Button>
                </div>
                <div className="mt-2 overflow-x-auto border border-border rounded">
                  <table className="min-w-full text-[11px]">
                    <thead>
                      <tr className="text-text-secondary">
                        <th className="text-left font-medium px-2 py-1">Item</th>
                        <th className="text-left font-medium px-2 py-1">Produto</th>
                        <th className="text-left font-medium px-2 py-1">Descrição</th>
                        <th className="text-left font-medium px-2 py-1">UN</th>
                        <th className="text-left font-medium px-2 py-1">CST</th>
                        <th className="text-right font-medium px-2 py-1">Qtde</th>
                        <th className="text-right font-medium px-2 py-1">Vr. Unit</th>
                        <th className="text-right font-medium px-2 py-1">Vr. ICMS</th>
                        <th className="text-right font-medium px-2 py-1">Vr. ICMS-ST</th>
                        <th className="text-right font-medium px-2 py-1">Vr. FCP</th>
                        <th className="text-right font-medium px-2 py-1">Total Item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualForm.itens.map((x, i)=>{
                        const pu = parseDec(x.preco_unitario)||0;
                        const q = parseDec(x.quantidade)||1;
                        const bruto = pu*q;
                        const descP = parseDec(x.desconto_percent)||0;
                        const descV = parseDec(x.desconto_valor)||0;
                        const acres = parseDec(x.acrescimos_valor)||0;
                        const desconto = descP ? (bruto*descP/100) : descV;
                        const totalItem = bruto - desconto + acres + (parseDec(x.frete_valor)||0) + (parseDec(x.seguro_valor)||0);
                        const cst = x.impostos?.icms?.cst || x.impostos?.icms?.csosn || '';
                        const icms = parseDec(x.impostos?.icms?.valor)||0;
                        const icmsst = parseDec(x.impostos?.icmsst?.valor)||0;
                        const fcp = parseDec(x.impostos?.fcp?.valor)||0;
                        return (
                          <tr key={i} className="border-t border-border/60">
                            <td className="px-2 py-1">{i+1}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{x.codigo||'—'}</td>
                            <td className="px-2 py-1 truncate max-w-[320px]">{x.descricao||'—'}</td>
                            <td className="px-2 py-1">{x.unidade||'UN'}</td>
                            <td className="px-2 py-1">{cst||'—'}</td>
                            <td className="px-2 py-1 text-right">{fmtMoney(q)}</td>
                            <td className="px-2 py-1 text-right">{fmtMoney(pu)}</td>
                            <td className="px-2 py-1 text-right">{fmtMoney(icms)}</td>
                            <td className="px-2 py-1 text-right">{fmtMoney(icmsst)}</td>
                            <td className="px-2 py-1 text-right">{fmtMoney(fcp)}</td>
                            <td className="px-2 py-1 text-right">{fmtMoney(totalItem)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="impostos">
              <div className="space-y-3">
                {manualForm.itens.map((it, idx) => (
                  <div key={idx} className="border border-border rounded-md p-2 cursor-pointer" onClick={handleItemClick(idx)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">Item {idx+1}: {(it.codigo? `${it.codigo} - `: '')}{it.descricao||'—'}</div>
                      <div className="text-xs text-text-secondary flex gap-3">
                        <span>ICMS {it.impostos?.icms?.cst||it.impostos?.icms?.csosn||'—'}/{it.impostos?.icms?.aliquota||'—'}%</span>
                        <span>PIS {it.impostos?.pis?.cst||'—'}/{it.impostos?.pis?.aliquota||'—'}%</span>
                        <span>COFINS {it.impostos?.cofins?.cst||'—'}/{it.impostos?.cofins?.aliquota||'—'}%</span>
                        <span>FCP {it.impostos?.fcp?.aliquota||'—'}%</span>
                        <span>IPI {it.impostos?.ipi?.cst||'—'}/{it.impostos?.ipi?.aliquota||'—'}%</span>
                        <span>{`Total R$ ${fmtMoney(((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)) - ((parseDec(it.desconto_percent)||0) ? ((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)*(parseDec(it.desconto_percent)||0)/100) : (parseDec(it.desconto_valor)||0)) + (parseDec(it.acrescimos_valor)||0) + (parseDec(it.frete_valor)||0) + (parseDec(it.seguro_valor)||0))}`}</span>
                      </div>
                    </div>
                    {expandedItem===idx && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                        <div>
                          <Label>Origem</Label>
                          <Input value={it.impostos?.origem||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, origem:e.target.value}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>ICMS CST</Label>
                          <Input value={it.impostos?.icms?.cst||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, cst:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>CSOSN</Label>
                          <Input value={it.impostos?.icms?.csosn||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, csosn:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Base ICMS</Label>
                          <Input value={it.impostos?.icms?.base||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, base:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Alíquota ICMS (%)</Label>
                          <Input value={it.impostos?.icms?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Valor ICMS</Label>
                          <Input value={it.impostos?.icms?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Base ICMS-ST</Label>
                          <Input value={it.impostos?.icmsst?.base||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icmsst:{...a[idx].impostos.icmsst, base:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Alíquota ICMS-ST (%)</Label>
                          <Input value={it.impostos?.icmsst?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icmsst:{...a[idx].impostos.icmsst, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Valor ICMS-ST</Label>
                          <Input value={it.impostos?.icmsst?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icmsst:{...a[idx].impostos.icmsst, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>FCP Base</Label>
                          <Input value={it.impostos?.fcp?.base||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, fcp:{...a[idx].impostos.fcp, base:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>FCP Alíquota (%)</Label>
                          <Input value={it.impostos?.fcp?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, fcp:{...a[idx].impostos.fcp, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>FCP Valor</Label>
                          <Input value={it.impostos?.fcp?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, fcp:{...a[idx].impostos.fcp, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>FCP-ST Base</Label>
                          <Input value={it.impostos?.fcpst?.base||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, fcpst:{...a[idx].impostos.fcpst, base:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>FCP-ST Alíquota (%)</Label>
                          <Input value={it.impostos?.fcpst?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, fcpst:{...a[idx].impostos.fcpst, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>FCP-ST Valor</Label>
                          <Input value={it.impostos?.fcpst?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, fcpst:{...a[idx].impostos.fcpst, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>ICMS Desonerado (R$)</Label>
                          <Input value={it.impostos?.icms?.desonerado_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, desonerado_valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Motivo da Desoneração</Label>
                          <Input value={it.impostos?.icms?.desoneracao_motivo||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, desoneracao_motivo:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>ICMS Operação (R$)</Label>
                          <Input value={it.impostos?.icms?.operacao_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, operacao_valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Alíquota Diferimento (%)</Label>
                          <Input value={it.impostos?.icms?.aliq_diferimento||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, aliq_diferimento:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>Valor ICMS Diferido</Label>
                          <Input value={it.impostos?.icms?.valor_diferido||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, valor_diferido:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>PIS CST</Label>
                          <Input value={it.impostos?.pis?.cst||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, pis:{...a[idx].impostos.pis, cst:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>PIS Alíquota (%)</Label>
                          <Input value={it.impostos?.pis?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, pis:{...a[idx].impostos.pis, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>PIS Valor</Label>
                          <Input value={it.impostos?.pis?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, pis:{...a[idx].impostos.pis, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>COFINS CST</Label>
                          <Input value={it.impostos?.cofins?.cst||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, cofins:{...a[idx].impostos.cofins, cst:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>COFINS Alíquota (%)</Label>
                          <Input value={it.impostos?.cofins?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, cofins:{...a[idx].impostos.cofins, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>COFINS Valor</Label>
                          <Input value={it.impostos?.cofins?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, cofins:{...a[idx].impostos.cofins, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>IPI CST</Label>
                          <Input value={it.impostos?.ipi?.cst||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, ipi:{...a[idx].impostos.ipi, cst:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>IPI - Tipo de Cálculo</Label>
                          <Select value={it.impostos?.ipi?.tipo_calculo||'nenhum'} onValueChange={(v)=>setManualForm(f=>{ const a=[...f.itens]; a[idx] = { ...a[idx], impostos:{...a[idx].impostos, ipi:{...a[idx].impostos.ipi, tipo_calculo:v}} }; return {...f, itens:a}; })}>
                            <SelectTrigger className="h-8 text-xs" />
                            <SelectContent>
                              <SelectItem value="aliquota">Alíquota</SelectItem>
                              <SelectItem value="valor_unit">Vl Unit.</SelectItem>
                              <SelectItem value="nenhum">Nenhum</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(it.impostos?.ipi?.tipo_calculo||'nenhum')==='aliquota' && (
                          <div>
                            <Label>IPI Alíquota (%)</Label>
                            <Input value={it.impostos?.ipi?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, ipi:{...a[idx].impostos.ipi, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                          </div>
                        )}
                        {(it.impostos?.ipi?.tipo_calculo||'nenhum')==='valor_unit' && (
                          <div>
                            <Label>IPI Valor Unitário</Label>
                            <Input value={it.impostos?.ipi?.valor_unit||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, ipi:{...a[idx].impostos.ipi, valor_unit:e.target.value}}}; return {...f, itens:a}; })} />
                          </div>
                        )}
                        <div>
                          <Label>IPI Valor</Label>
                          <Input value={it.impostos?.ipi?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, ipi:{...a[idx].impostos.ipi, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>ISS Alíquota (%)</Label>
                          <Input value={it.impostos?.iss?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, iss:{...a[idx].impostos.iss, aliquota:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div>
                          <Label>ISS Valor</Label>
                          <Input value={it.impostos?.iss?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, iss:{...a[idx].impostos.iss, valor:e.target.value}}}; return {...f, itens:a}; })} />
                        </div>
                        <div className="md:col-span-6">
                          <details>
                            <summary className="text-xs text-text-secondary cursor-pointer select-none">Impostos 2 (Avançado)</summary>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-6 gap-2">
                              <div>
                                <Label>AD Rem</Label>
                                <Input value={it.impostos?.icms?.ad_rem||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, ad_rem:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>AD Rem Retenção</Label>
                                <Input value={it.impostos?.icms?.ad_rem_retencao||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, ad_rem_retencao:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>BC Monofásico</Label>
                                <Input value={it.impostos?.icms?.monofasico_bc||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, monofasico_bc:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>ICMS Monofásico</Label>
                                <Input value={it.impostos?.icms?.monofasico_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, monofasico_valor:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>BC Mono Retenção</Label>
                                <Input value={it.impostos?.icms?.mono_retencao_bc||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, mono_retencao_bc:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>ICMS Mono Retenção</Label>
                                <Input value={it.impostos?.icms?.mono_retencao_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, mono_retencao_valor:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>% Redução</Label>
                                <Input value={it.impostos?.icms?.reducao_percent||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, reducao_percent:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>Motivo da Redução</Label>
                                <Input value={it.impostos?.icms?.reducao_motivo||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, reducao_motivo:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>BC Mono Cobrado Ant.</Label>
                                <Input value={it.impostos?.icms?.mono_cobrado_ant_bc||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, mono_cobrado_ant_bc:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>ICMS Mono Cobrado Ant.</Label>
                                <Input value={it.impostos?.icms?.mono_cobrado_ant_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, mono_cobrado_ant_valor:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div>
                                <Label>ICMS Próprio Devido</Label>
                                <Input value={it.impostos?.icms?.proprio_devido_valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, icms:{...a[idx].impostos.icms, proprio_devido_valor:e.target.value}}}; return {...f, itens:a}; })} />
                              </div>
                              <div className="md:col-span-6 border-t border-border/40 pt-2">
                                <div className="text-xs text-text-secondary mb-1">Grupo indicador da origem do combustível</div>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                                  <div>
                                    <Label>UF</Label>
                                    <Input value={it.impostos?.combustivel?.uf||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, combustivel:{...a[idx].impostos.combustivel, uf:e.target.value}}}; return {...f, itens:a}; })} />
                                  </div>
                                  <div>
                                    <Label>% origem UF</Label>
                                    <Input value={it.impostos?.combustivel?.perc_origem_uf||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, combustivel:{...a[idx].impostos.combustivel, perc_origem_uf:e.target.value}}}; return {...f, itens:a}; })} />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label>Indicador de importação</Label>
                                    <Input value={it.impostos?.combustivel?.indicador_importacao||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, combustivel:{...a[idx].impostos.combustivel, indicador_importacao:e.target.value}}}; return {...f, itens:a}; })} />
                                  </div>
                                </div>
                              </div>
                              <div className="md:col-span-6 border-t border-border/40 pt-2">
                                <div className="text-xs text-text-secondary mb-1">CIDE</div>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                                  <div>
                                    <Label>Aliq. CIDE</Label>
                                    <Input value={it.impostos?.cide?.aliq||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, cide:{...a[idx].impostos.cide, aliq:e.target.value}}}; return {...f, itens:a}; })} />
                                  </div>
                                  <div>
                                    <Label>BC CIDE</Label>
                                    <Input value={it.impostos?.cide?.base||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, cide:{...a[idx].impostos.cide, base:e.target.value}}}; return {...f, itens:a}; })} />
                                  </div>
                                  <div>
                                    <Label>Vl. CIDE</Label>
                                    <Input value={it.impostos?.cide?.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], impostos:{...a[idx].impostos, cide:{...a[idx].impostos.cide, valor:e.target.value}}}; return {...f, itens:a}; })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="totais">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Desconto Geral (R$)</Label>
                  <Input value={manualForm.totais.desconto_geral} onChange={(e)=>setManualForm(f=>({...f, totais:{...f.totais, desconto_geral:e.target.value}}))} />
                </div>
                <div>
                  <Label>Frete (R$)</Label>
                  <Input value={manualForm.totais.frete} onChange={(e)=>setManualForm(f=>({...f, totais:{...f.totais, frete:e.target.value}}))} />
                </div>
                <div>
                  <Label>Outras Despesas (R$)</Label>
                  <Input value={manualForm.totais.outras_despesas} onChange={(e)=>setManualForm(f=>({...f, totais:{...f.totais, outras_despesas:e.target.value}}))} />
                </div>
                <div className="mt-6 text-sm">
                  <span className="text-text-secondary">Total itens: </span>
                  {fmtMoney(manualForm.itens.reduce((s,x)=>{ const pu=parseDec(x.preco_unitario); const q=parseDec(x.quantidade)||1; const descP=parseDec(x.desconto_percent)||0; const descV=parseDec(x.desconto_valor)||0; const acres=parseDec(x.acrescimos_valor)||0; const bruto=pu*q; const d = descP? (bruto*descP/100) : descV; return s + (bruto - d + acres); },0))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pagamento">
              <div className="space-y-3">
                {manualForm.pagamentos.map((p, idx)=> (
                  <div key={idx} className="grid grid-cols-1 gap-2 items-end md:[grid-template-columns:2fr_1fr_1fr_1fr_auto]">
                    <div>
                      <Label>Finalizadora</Label>
                      <Select value={p.finalizadora_id||''} onValueChange={(id)=>setManualForm(f=>{ const a=[...f.pagamentos]; const fin = (payMethods||[]).find(x=>String(x.id)===String(id)); a[idx] = { ...a[idx], finalizadora_id:id, tipo: fin?.nome || a[idx].tipo }; return { ...f, pagamentos:a }; })}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={payMethods.length? 'Selecionar' : 'Carregando…'} />
                        </SelectTrigger>
                        <SelectContent>
                          {payMethods.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {`${(m?.codigo_interno!=null && String(m.codigo_interno).trim()!=='') ? String(m.codigo_interno).padStart(2,'0') + ' - ' : ''}${m?.nome || '—'}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Valor</Label>
                      <Input className="h-9" inputMode="decimal" value={p.valor||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.pagamentos]; a[idx]={...a[idx], valor: moneyMaskBR(e.target.value)}; return {...f, pagamentos:a}; })} />
                    </div>
                    <div>
                      <Label>Parcelas</Label>
                      <Input className="h-9" inputMode="numeric" value={p.parcelas||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.pagamentos]; a[idx]={...a[idx], parcelas: onlyDigits(e.target.value)}; return {...f, pagamentos:a}; })} />
                    </div>
                    <div>
                      <Label>Troco</Label>
                      <Input className="h-9" inputMode="decimal" value={p.troco||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.pagamentos]; a[idx]={...a[idx], troco: moneyMaskBR(e.target.value)}; return {...f, pagamentos:a}; })} />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button type="button" size="icon" variant="ghost" className="text-red-500 hover:text-red-600" title="Remover pagamento" onClick={()=>setManualForm(f=>({ ...f, pagamentos: f.pagamentos.filter((_,i)=>i!==idx) }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-start">
                  <Button size="sm" variant="outline" onClick={()=>setManualForm(f=>{ const def = (payMethods||[])[0]; return { ...f, pagamentos:[...f.pagamentos, { finalizadora_id: def?.id || '', tipo: def?.nome || 'Dinheiro', valor:'' }] }; })}>Adicionar pagamento</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transporte">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Tipo do frete</Label>
                  <Input value={manualForm.transporte.tipo_frete} onChange={(e)=>setManualForm(f=>({...f, transporte:{...f.transporte, tipo_frete:e.target.value}}))} />
                </div>
                <div>
                  <Label>Transportadora</Label>
                  <Input value={manualForm.transporte.transportadora} onChange={(e)=>setManualForm(f=>({...f, transporte:{...f.transporte, transportadora:e.target.value}}))} />
                </div>
                <div>
                  <Label>Placa</Label>
                  <Input value={manualForm.transporte.placa} onChange={(e)=>setManualForm(f=>({...f, transporte:{...f.transporte, placa:e.target.value}}))} />
                </div>
                <div>
                  <Label>Volumes</Label>
                  <Input value={manualForm.transporte.volumes} onChange={(e)=>setManualForm(f=>({...f, transporte:{...f.transporte, volumes:e.target.value}}))} />
                </div>
                <div>
                  <Label>Peso líquido</Label>
                  <Input value={manualForm.transporte.peso_liquido} onChange={(e)=>setManualForm(f=>({...f, transporte:{...f.transporte, peso_liquido:e.target.value}}))} />
                </div>
                <div>
                  <Label>Peso bruto</Label>
                  <Input value={manualForm.transporte.peso_bruto} onChange={(e)=>setManualForm(f=>({...f, transporte:{...f.transporte, peso_bruto:e.target.value}}))} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="adicionais">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Observações gerais</Label>
                  <Input value={manualForm.adicionais.obs_gerais} onChange={(e)=>setManualForm(f=>({...f, adicionais:{...f.adicionais, obs_gerais:e.target.value}}))} />
                </div>
                <div>
                  <Label>Info para o Fisco</Label>
                  <Input value={manualForm.adicionais.info_fisco} onChange={(e)=>setManualForm(f=>({...f, adicionais:{...f.adicionais, info_fisco:e.target.value}}))} />
                </div>
                <div>
                  <Label>Info para o Cliente</Label>
                  <Input value={manualForm.adicionais.info_cliente} onChange={(e)=>setManualForm(f=>({...f, adicionais:{...f.adicionais, info_cliente:e.target.value}}))} />
                </div>
                <div>
                  <Label>Referência documento</Label>
                  <Input value={manualForm.adicionais.referencia_doc} onChange={(e)=>setManualForm(f=>({...f, adicionais:{...f.adicionais, referencia_doc:e.target.value}}))} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="rastreabilidade">
              <div className="text-sm text-text-secondary">Rastreabilidade de Produtos</div>
            </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={()=>setManualOpen(false)}>Fechar</Button>
            <Button onClick={async ()=>{
              try {
                const issues = [];
                const doc = onlyDigits(manualForm.cpf_cnpj);
                if (manualForm.tipo_pessoa === 'PF' && doc && doc.length !== 11) issues.push('CPF deve ter 11 dígitos');
                if (manualForm.tipo_pessoa === 'PJ' && doc && doc.length !== 14) issues.push('CNPJ deve ter 14 dígitos');
                if (!manualForm.nome) issues.push('Nome/Razão não informado');
                if (manualForm.email && !isEmail(manualForm.email)) issues.push('Email inválido');
                if (manualForm.uf && manualForm.uf.length !== 2) issues.push('UF deve ter 2 letras');
                if (manualForm.cep && onlyDigits(manualForm.cep).length !== 8) issues.push('CEP deve ter 8 dígitos');
                if (!manualForm.codigo_municipio_ibge) issues.push('Código IBGE do município é obrigatório');
                const itemIssues = [];
                manualForm.itens.forEach((x,i)=>{
                  if (!x.descricao) itemIssues.push(`Item ${i+1}: descrição obrigatória`);
                  if (!x.ncm || onlyDigits(x.ncm).length !== 8) itemIssues.push(`Item ${i+1}: NCM deve ter 8 dígitos`);
                  if (!x.cfop || onlyDigits(x.cfop).length !== 4) itemIssues.push(`Item ${i+1}: CFOP deve ter 4 dígitos`);
                  if (parseDec(x.quantidade) <= 0) itemIssues.push(`Item ${i+1}: quantidade deve ser > 0`);
                  if (parseDec(x.preco_unitario) <= 0) itemIssues.push(`Item ${i+1}: preço deve ser > 0`);
                });
                issues.push(...itemIssues);
                if (issues.length) { toast({ title: 'Pendências para gerar XML', description: issues.join('\n'), variant: 'destructive' }); return; }
                const itens = manualForm.itens.map(x=>{
                  const pu = parseDec(x.preco_unitario)||0;
                  const q = parseDec(x.quantidade)||1;
                  const bruto = pu*q;
                  const descP = parseDec(x.desconto_percent)||0;
                  const descV = parseDec(x.desconto_valor)||0;
                  const acres = parseDec(x.acrescimos_valor)||0;
                  const desconto = descP ? (bruto*descP/100) : descV;
                  const totalItem = bruto - desconto + acres;
                  return {
                    preco_unitario: pu,
                    quantidade: q,
                    preco_total: totalItem,
                    produtos: { nome: x.descricao||'Produto', codigo: x.codigo||'', ncm: x.ncm||'', cfopInterno: x.cfop||'5102' }
                  };
                });
                const totalItens = itens.reduce((s,i)=> s + (Number(i.preco_total)||0), 0);
                const total = totalItens - (parseDec(manualForm.totais.desconto_geral)||0) + (parseDec(manualForm.totais.frete)||0) + (parseDec(manualForm.totais.outras_despesas)||0);
                const cliente = {
                  tipo_pessoa: manualForm.tipo_pessoa,
                  cpf_cnpj: onlyDigits(manualForm.cpf_cnpj),
                  nome: manualForm.nome,
                  email: manualForm.email,
                  logradouro: manualForm.logradouro,
                  numero: manualForm.numero,
                  bairro: manualForm.bairro,
                  cidade: manualForm.cidade,
                  uf: manualForm.uf,
                  cep: onlyDigits(manualForm.cep),
                  codigo_municipio_ibge: manualForm.codigo_municipio_ibge,
                  inscricao_estadual: manualForm.ie_isento ? 'ISENTO' : manualForm.inscricao_estadual,
                  telefone: manualForm.telefone,
                };
                const pagamentos = (manualForm.pagamentos && manualForm.pagamentos.length) ? manualForm.pagamentos.map(p=>{ const fin = (payMethods||[]).find(x=>String(x.id)===String(p.finalizadora_id)); const cod = fin?.codigo_sefaz || '99'; return { finalizadoras: { codigo_sefaz: cod }, valor: parseDec(p.valor)||0 }; }) : [{ finalizadoras:{ codigo_sefaz:'99' }, valor: total }];
                const xml = await gerarXMLNFeFromData({ codigoEmpresa, cliente, itens, pagamentos, modelo: '55', overrides: { natOp: manualForm.natOp, serie: manualForm.serie, nNF: manualForm.nNF, indFinal: manualForm.indFinal, indPres: manualForm.indPres, idDest: manualForm.idDest, tpNF: manualForm.tipo_nota==='entrada' ? '0' : '1' } });
                setManualXml(xml);
                setXmlPreviewOpen(true);
                toast({ title: 'XML NF-e gerado' });
              } catch (e) { toast({ title: 'Falha ao gerar XML', description: e.message, variant: 'destructive' }); }
            }}>Gerar XML</Button>
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
              <Select value={nfeForm.idDest || ''} onValueChange={(v)=>setNfeForm(f=>({...f, idDest: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Automático" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Automático</SelectItem>
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
