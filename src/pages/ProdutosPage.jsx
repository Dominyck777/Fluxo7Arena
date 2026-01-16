import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, List, LayoutGrid, Download, Edit, Trash2, Trophy, AlertTriangle, CalendarX, Tag, Filter, Eye, EyeOff, FileText, CheckCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { listProductsPaged, listProducts, createProduct, updateProduct, deleteProduct, listCategories, createCategory, removeCategory, getMostSoldProductsToday, getSoldProductsByPeriod, adjustProductStock, bulkUpdateProductStatus, bulkClearNewFlag, getNextProductCode } from '@/lib/products';
import { getUserUISettings, saveUserUISettings } from '@/lib/userSettings';
import { useAuth } from '@/contexts/AuthContext';
import XMLImportModal from '@/components/XMLImportModal';

const initialProducts = [];

const initialCategories = [];

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const PRODUTOS_SETTINGS_KEY = 'produtosPage:settings';

const CSOSN_OPTIONS = ['101','102','103','201','202','203','300','400','500','900'];

// ===== Export Helpers =====

function downloadProductsCsv(rows) {
  // Cabeçalhos ampliados
  const headers = [
    'Código','Produto','Categoria','Tipo','Unidade',
    'Preço Custo','Preço Venda','% Lucro',
    'Estoque','Estoque Mín.','Validade','Status','Ativo',
    'EAN-13','EAN-13 Caixa','Referência','Marca','Grupo',
    'NCM','Descrição NCM','CEST',
    'Usar CSOSN',
    'CFOP Interno','CST ICMS Interno','CSOSN Interno','Aliq ICMS Interno (%)',
    'CFOP Externo','CST ICMS Externo','CSOSN Externo','Aliq ICMS Externo (%)',
    'CST PIS Entrada','CST PIS Saída','Aliq PIS (%)','Aliq COFINS (%)',
    'CST IPI','Aliq IPI (%)',
    'FCP (%)','MVA (%)','Base Reduzida (%)'
  ];
  const sep = ';'; // Excel pt-BR lida melhor com ; quando vírgula é decimal
  const toBR = (n) => {
    const num = Number(n ?? 0);
    return Number.isFinite(num) ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
  };
  const fmtMoney = (n) => `R$ ${toBR(n)}`;
  const fmtPercent = (n) => {
    const num = Number(n ?? 0);
    return Number.isFinite(num) ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  };
  const fmtDate = (v) => {
    if (!v) return '';
    try {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y,m,d] = v.split('-');
        return `${d}/${m}/${y}`;
      }
      const d = new Date(v);
      if (!isNaN(d)) {
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yy = d.getFullYear();
        return `${dd}/${mm}/${yy}`;
      }
    } catch {}
    return String(v);
  };
  const fmtStatus = (s) => s === 'active' ? 'Ativo' : s === 'low_stock' ? 'Estoque Baixo' : s === 'inactive' ? 'Inativo' : '';
  const fmtBool = (b) => (b ? 'Sim' : 'Não');
  const empty = (v) => (v == null ? '' : v);
  const escape = (val) => {
    const v = val == null ? '' : String(val);
    return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [];
  lines.push('\uFEFF' + headers.join(sep)); // BOM para Excel + cabeçalho
  for (const p of rows) {
    const record = [
      empty(p.code),
      empty(p.name),
      empty(p.category),
      empty(p.type),
      empty(p.unit),
      fmtMoney(p.costPrice),
      fmtMoney(p.price ?? p.salePrice),
      fmtPercent(p.marginPercent),
      Number(p.stock ?? 0),
      Number(p.minStock ?? 0),
      fmtDate(p.validade),
      fmtStatus(p.status),
      fmtBool(p.active !== false),
      empty(p.barcode),
      empty(p.barcodeBox),
      empty(p.reference),
      empty(p.brand),
      empty(p.group),
      empty(p.ncm),
      empty(p.ncmDescription),
      empty(p.cest),
      (p.useCsosn ? 'Sim' : ''),
      empty(p.cfopInterno),
      empty(p.cstIcmsInterno),
      empty(p.csosnInterno),
      fmtPercent(p.aliqIcmsInterno),
      empty(p.cfopExterno),
      empty(p.cstIcmsExterno),
      empty(p.csosnExterno),
      fmtPercent(p.aliqIcmsExterno),
      empty(p.cstPisEntrada),
      empty(p.cstPisSaida),
      fmtPercent(p.aliqPisPercent),
      fmtPercent(p.aliqCofinsPercent),
      empty(p.cstIpi),
      fmtPercent(p.aliqIpiPercent),
      fmtPercent(p.fcpPercent),
      fmtPercent(p.mvaPercent),
      fmtPercent(p.baseReduzidaPercent),
    ].map(escape).join(sep);
    lines.push(record);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'produtos.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== Toast Helpers =====
function mapDbErrorToMessage(err, { action } = {}) {
  const raw = String(err?.message || err || '').toLowerCase();
  // remoção de categoria com produtos ativos
  if (raw.includes('categoria possui produtos ativos vinculados')) {
    return { title: 'Não é possível remover', description: 'Existem produtos ativos vinculados a esta categoria. Inative ou recategorizê-os antes.' };
  }
  if (raw.includes('categoria não encontrada')) {
    return { title: 'Categoria não encontrada', description: 'Não foi possível localizar a categoria para desativação.' };
  }
  // código duplicado
  if (raw.includes('duplicate key') && raw.includes('ux_produtos_empresa_codigo_produto')) {
    return {
      title: 'Código já cadastrado',
      description: 'Já existe um produto com este código na sua empresa. Informe outro código.',
    };
  }
  // genérico: qualquer unique constraint
  if (raw.includes('duplicate key') && raw.includes('unique constraint')) {
    return { title: 'Registro já existe', description: 'Já existe um registro com estes dados.' };
  }
  // permissão / RLS
  if (raw.includes('permission denied') || raw.includes('violates row-level security') || raw.includes('rls')) {
    return { title: 'Sem permissão', description: 'Você não tem permissão para executar esta ação.' };
  }
  // not null constraint: campo obrigatório
  const notNull = raw.match(/null value in column "([^"]+)" violates not-null constraint/);
  if (notNull) {
    const col = notNull[1].replace(/_/g, ' ');
    return { title: 'Campo obrigatório', description: `Preencha o campo "${col}".` };
  }
  // invalid input syntax (numérico, data, uuid)
  if (raw.includes('invalid input syntax') || raw.includes('invalid input value')) {
    return { title: 'Valor inválido', description: 'Revise os valores informados (formato inválido).' };
  }
  // check constraint (validations no banco)
  if (raw.includes('violates check constraint')) {
    return { title: 'Valor inválido', description: 'Os dados informados não atendem às regras do sistema.' };
  }
  // foreign key: impedir exclusão/relacionamento
  if (raw.includes('violates foreign key constraint')) {
    if (raw.includes('update or delete on table')) {
      return { title: 'Não é possível excluir', description: 'Existem registros vinculados que impedem a exclusão.' };
    }
    return { title: 'Relação inválida', description: 'O registro relacionado não foi encontrado ou é inválido.' };
  }
  // rede/timeout
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('network error')) {
    return { title: 'Falha de conexão', description: 'Verifique sua internet e tente novamente.' };
  }
  if (raw.includes('timeout')) {
    return { title: 'Tempo esgotado', description: 'A operação demorou demais. Tente novamente.' };
  }
  // rate limit
  if (raw.includes('rate limit') || raw.includes('too many requests') || raw.includes('status code 429')) {
    return { title: 'Muitas solicitações', description: 'Aguarde alguns segundos e tente novamente.' };
  }
  // fallback por ação
  if (action === 'save') return { title: 'Falha ao salvar', description: 'Não foi possível salvar o produto. Tente novamente.' };
  if (action === 'delete') return { title: 'Falha ao inativar', description: 'Não foi possível inativar o produto.' };
  if (action === 'fetch') return { title: 'Erro ao carregar', description: 'Não foi possível atualizar a lista de produtos.' };
  if (action === 'export') return { title: 'Falha ao exportar', description: 'Não foi possível gerar o arquivo.' };
  return { title: 'Erro', description: err?.message || 'Ocorreu um erro.' };
}

const StatCard = ({ icon, title, value, subtitle, color, onClick, isActive }) => {
    const Icon = icon;
    return (
        <motion.div
          variants={itemVariants}
          className={cn(
            "bg-surface rounded-2xl border-2 p-3 sm:p-4 flex flex-col justify-between gap-2 cursor-pointer transition-all duration-300",
            isActive ? `${color}/30 border-${color}` : 'border-border hover:border-border-hover',
          )}
          onClick={onClick}
        >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-text-secondary text-xs sm:text-sm font-semibold leading-snug whitespace-nowrap overflow-hidden text-ellipsis">{title}</p>
              <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0", color)} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-text-primary leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
              <p className="hidden sm:block text-xs text-text-muted">{subtitle}</p>
            </div>
        </motion.div>
    );
};

function ProductFormModal({ open, onOpenChange, product, onSave, categories, onCreateCategory, suggestedCode, onRefreshProducts, products }) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dados');
  const [code, setCode] = useState(product?.code || '');
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || '');
  const [type, setType] = useState(product?.type || 'Venda');
  const [unit, setUnit] = useState(product?.unit || 'UN');
  const [active, setActive] = useState(product?.active ?? true);
  const [barcode, setBarcode] = useState(product?.barcode || '');
  // Outras Info
  const [barcodeBox, setBarcodeBox] = useState(product?.barcodeBox || '');
  const [reference, setReference] = useState(product?.reference || '');
  const [brand, setBrand] = useState(product?.brand || '');
  const [group, setGroup] = useState(product?.group || '');
  // Parâmetros (toggles)
  const [allowSale, setAllowSale] = useState(!!product?.allowSale);
  const [payCommission, setPayCommission] = useState(!!product?.payCommission);
  const [variablePrice, setVariablePrice] = useState(!!product?.variablePrice);
  const [composition, setComposition] = useState(!!product?.composition);
  const [service, setService] = useState(!!product?.service);
  const [hasGrid, setHasGrid] = useState(!!product?.hasGrid);
  const [usePriceTable, setUsePriceTable] = useState(!!product?.usePriceTable);
  const [fuel, setFuel] = useState(!!product?.fuel);
  const [useImei, setUseImei] = useState(!!product?.useImei);
  const [stockByGrid, setStockByGrid] = useState(!!product?.stockByGrid);
  const [showInApp, setShowInApp] = useState(!!product?.showInApp);
  // Preço e Lucro (simplificado: Custo e Venda)
  const [costPrice, setCostPrice] = useState(product?.costPrice != null
    ? Number(product.costPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (product?.cost != null
      ? Number(product.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '')
  );
  const [salePrice, setSalePrice] = useState(
    product?.salePrice != null ? Number(product.salePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : product?.price != null ? Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''
  );
  const [marginPercent, setMarginPercent] = useState(product?.marginPercent != null ? String(Number(product.marginPercent).toFixed(2)).replace('.', ',') : '');
  const [stock, setStock] = useState(product?.stock ? String(product.stock) : '');
  const [minStock, setMinStock] = useState(product?.minStock ? String(product.minStock) : '');
  const [status, setStatus] = useState(product?.status || 'active');
  const [validade, setValidade] = useState(product?.validade || null);
  const [saving, setSaving] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  // Edição: habilitada por padrão (edição inline sem botão Editar)
  const [editEnabled, setEditEnabled] = useState(true);
  // Impostos / Fiscais
  const [useCsosn, setUseCsosn] = useState(!!(product?.csosnInterno || product?.csosnExterno));
  // ICMS
  const [cfopInterno, setCfopInterno] = useState(product?.cfopInterno || '');
  const [cstIcmsInterno, setCstIcmsInterno] = useState(product?.cstIcmsInterno || '');
  const [csosnInterno, setCsosnInterno] = useState(product?.csosnInterno || '');
  const [aliqIcmsInterno, setAliqIcmsInterno] = useState(product?.aliqIcmsInterno != null ? String(product.aliqIcmsInterno).replace('.', ',') : '');
  const [cfopExterno, setCfopExterno] = useState(product?.cfopExterno || '');
  const [cstIcmsExterno, setCstIcmsExterno] = useState(product?.cstIcmsExterno || '');
  const [csosnExterno, setCsosnExterno] = useState(product?.csosnExterno || '');
  const [aliqIcmsExterno, setAliqIcmsExterno] = useState(product?.aliqIcmsExterno != null ? String(product.aliqIcmsExterno).replace('.', ',') : '');
  // PIS/COFINS
  const [cstPisEntrada, setCstPisEntrada] = useState(product?.cstPisEntrada || '');
  const [cstPisSaida, setCstPisSaida] = useState(product?.cstPisSaida || '');
  const [aliqPisPercent, setAliqPisPercent] = useState(product?.aliqPisPercent != null ? String(product.aliqPisPercent).replace('.', ',') : '');
  const [aliqCofinsPercent, setAliqCofinsPercent] = useState(product?.aliqCofinsPercent != null ? String(product.aliqCofinsPercent).replace('.', ',') : '');
  // IPI
  const [cstIpi, setCstIpi] = useState(product?.cstIpi || '');
  const [aliqIpiPercent, setAliqIpiPercent] = useState(product?.aliqIpiPercent != null ? String(product.aliqIpiPercent).replace('.', ',') : '');
  const [fcpPercent, setFcpPercent] = useState(product?.fcpPercent != null ? String(product.fcpPercent).replace('.', ',') : '');
  const [mvaPercent, setMvaPercent] = useState(product?.mvaPercent != null ? String(product.mvaPercent).replace('.', ',') : '');
  const [baseReduzidaPercent, setBaseReduzidaPercent] = useState(product?.baseReduzidaPercent != null ? String(product.baseReduzidaPercent).replace('.', ',') : '');
  const [ncm, setNcm] = useState(product?.ncm || '');
  const [ncmDescription, setNcmDescription] = useState(product?.ncmDescription || '');
  const [cest, setCest] = useState(product?.cest || '');
  
  // Modais independentes
  const [showDismemberModal, setShowDismemberModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const formatCurrencyBR = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    const number = digits ? Number(digits) / 100 : 0;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currencyToNumber = (value) => {
    if (!value) return 0;
    // remove thousand separators and replace comma with dot
    const normalized = String(value).replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const formatPercent = (value) => {
    // Permite digitação livre, apenas remove caracteres inválidos
    const cleaned = String(value || '').replace(/[^\d,]/g, '');
    // Formata com % na frente
    return cleaned ? `% ${cleaned}` : '';
  };

  const percentToNumber = (value) => {
    if (value == null || value === '') return 0;
    const normalized = String(value).replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const formatEAN13 = (value) => {
    return String(value || '').replace(/\D/g, '').slice(0, 13);
  };

  const formatCFOP = (value) => {
    return String(value || '').replace(/\D/g, '').slice(0,4);
  };

  const formatNCM = (value) => {
    return String(value || '').replace(/\D/g, '').slice(0,8);
  };

  const formatCEST = (value) => {
    return String(value || '').replace(/\D/g, '').slice(0,7);
  };

  useEffect(() => {
    setCode(product?.code || '');
    setName(product?.name || '');
    setCategory(product?.category || '');
    setType(product?.type || 'Venda');
    setUnit(product?.unit || 'UN');
    setActive(product?.active ?? true);
    setBarcode(product?.barcode || '');
    setBarcodeBox(product?.barcodeBox || '');
    setReference(product?.reference || '');
    setBrand(product?.brand || '');
    setGroup(product?.group || '');
    setAllowSale(!!product?.allowSale);
    setPayCommission(!!product?.payCommission);
    setVariablePrice(!!product?.variablePrice);
    setComposition(!!product?.composition);
    setService(!!product?.service);
    setHasGrid(!!product?.hasGrid);
    setUsePriceTable(!!product?.usePriceTable);
    setFuel(!!product?.fuel);
    setUseImei(!!product?.useImei);
    setStockByGrid(!!product?.stockByGrid);
    setShowInApp(!!product?.showInApp);
    setCostPrice(product?.costPrice != null
      ? Number(product.costPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (product?.cost != null
        ? Number(product.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '')
    );
    setSalePrice(
      product?.salePrice != null ? Number(product.salePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : product?.price != null ? Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''
    );
    setMarginPercent(product?.marginPercent != null ? String(Number(product.marginPercent).toFixed(2)).replace('.', ',') : '');
    setStock(product?.stock ? String(product.stock) : '');
    setMinStock(product?.minStock ? String(product.minStock) : '');
    setStatus(product?.status || 'active');
    setValidade(product?.validade || null);
    // Fiscais
    setUseCsosn(!!(product?.csosnInterno || product?.csosnExterno));
    setCfopInterno(product?.cfopInterno || '');
    setCstIcmsInterno(product?.cstIcmsInterno || '');
    setCsosnInterno(product?.csosnInterno || '');
    setAliqIcmsInterno(product?.aliqIcmsInterno != null ? String(product.aliqIcmsInterno).replace('.', ',') : '');
    setCfopExterno(product?.cfopExterno || '');
    setCstIcmsExterno(product?.cstIcmsExterno || '');
    setCsosnExterno(product?.csosnExterno || '');
    setAliqIcmsExterno(product?.aliqIcmsExterno != null ? String(product.aliqIcmsExterno).replace('.', ',') : '');
    setCstPisEntrada(product?.cstPisEntrada || '');
    setCstPisSaida(product?.cstPisSaida || '');
    setAliqPisPercent(product?.aliqPisPercent != null ? String(product.aliqPisPercent).replace('.', ',') : '');
    setAliqCofinsPercent(product?.aliqCofinsPercent != null ? String(product.aliqCofinsPercent).replace('.', ',') : '');
    setCstIpi(product?.cstIpi || '');
    setAliqIpiPercent(product?.aliqIpiPercent != null ? String(product.aliqIpiPercent).replace('.', ',') : '');
    setFcpPercent(product?.fcpPercent != null ? String(product.fcpPercent).replace('.', ',') : '');
    setMvaPercent(product?.mvaPercent != null ? String(product.mvaPercent).replace('.', ',') : '');
    setBaseReduzidaPercent(product?.baseReduzidaPercent != null ? String(product.baseReduzidaPercent).replace('.', ',') : '');
    setNcm(product?.ncm || '');
    setNcmDescription(product?.ncmDescription || '');
    setCest(product?.cest || '');
    // Edição sempre habilitada
    setEditEnabled(true);
    // Sugestão automática de código para novo produto
    if (!product && suggestedCode && !code) {
      setCode(suggestedCode);
    }
    // Limpar modais ao trocar de produto
    setShowDismemberModal(false);
    setShowMergeModal(false);
  }, [product, open]);

  // Auto-cálculos: custo e margem
  // Cálculo bidirecional: editar margem atualiza preço de venda, editar preço atualiza margem
  const lastEditedFieldRef = useRef('salePrice'); // 'salePrice' ou 'marginPercent'

  // Quando custo ou preço de venda mudam, recalcula margem (se último campo editado foi preço)
  useEffect(() => {
    if (lastEditedFieldRef.current === 'salePrice') {
      const cp = currencyToNumber(costPrice);
      const sp = currencyToNumber(salePrice);
      if (sp > 0) {
        const m = ((sp - cp) / sp) * 100;
        setMarginPercent(m.toFixed(2).replace('.', ','));
      } else {
        setMarginPercent('');
      }
    }
  }, [costPrice, salePrice]);

  // Quando margem muda, recalcula preço de venda (se último campo editado foi margem)
  // Usa debounce para evitar cálculos enquanto digita
  useEffect(() => {
    if (lastEditedFieldRef.current === 'marginPercent') {
      const timer = setTimeout(() => {
        const cp = currencyToNumber(costPrice);
        const m = percentToNumber(marginPercent);
        console.log('[Margem] Custo:', cp, 'Margem:', m);
        if (cp > 0 && m > 0) {
          if (m >= 100) {
            // Margem >= 100%: usar fórmula alternativa (markup)
            // PreçoVenda = PreçoCusto * (1 + Margem/100)
            const sp = cp * (1 + m / 100);
            console.log('[Margem] Preço calculado (markup):', sp);
            setSalePrice(sp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          } else {
            // Margem < 100%: fórmula normal
            // PreçoVenda = PreçoCusto / (1 - Margem/100)
            const sp = cp / (1 - m / 100);
            console.log('[Margem] Preço calculado (margem):', sp);
            setSalePrice(sp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          }
        }
      }, 500); // Aguarda 500ms após parar de digitar
      return () => clearTimeout(timer);
    }
  }, [marginPercent, costPrice]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return; // guard against double click / duplicate submissions
    // Validações obrigatórias
    const errors = [];
    // Código pode ser vazio: será gerado automaticamente no salvamento
    if (!name?.trim()) errors.push('Descrição');
    if (!unit?.trim()) errors.push('Unidade');
    if (!type) errors.push('Tipo de Produto');
    if (currencyToNumber(salePrice) <= 0) errors.push('Preço de Venda');
    if (useCsosn && !csosnInterno?.trim()) errors.push('CSOSN Interno (Simples Nacional)');
    if (errors.length) {
      toast({ title: 'Preencha os campos obrigatórios', description: errors.join(', '), variant: 'destructive' });
      return;
    }
    console.log('[ProdutosPage] handleSave - Estado active antes de salvar:', active);
    
    // Sincronizar status com active: se inativo, forçar status='inactive'
    let finalStatus = status;
    if (!active) {
      finalStatus = 'inactive';
    } else if (status === 'inactive' && active) {
      // Se está ativando um produto que estava inativo, voltar para active
      finalStatus = 'active';
    }
    console.log('[ProdutosPage] handleSave - Status ajustado:', finalStatus);
    
    const payload = {
      id: product?.id,
      code: code?.trim() || '',
      name,
      category,
      type,
      // Estoque
      stock: Number(stock || 0),
      minStock: Number(minStock || 0),
      // Datas/Status
      status: finalStatus,
      validade,
      // Dados
      unit,
      active,
      barcode: formatEAN13(barcode),
      barcodeBox: formatEAN13(barcodeBox),
      reference: reference?.trim() || null,
      brand: brand?.trim() || null,
      group: group?.trim() || null,
      // Preço e Lucro (simplificado)
      cost: currencyToNumber(costPrice),
      price: currencyToNumber(salePrice),
      buyPrice: null,
      costsPercent: null,
      costPrice: currencyToNumber(costPrice),
      salePrice: currencyToNumber(salePrice),
      marginPercent: percentToNumber(marginPercent),
      // Parâmetros
      allowSale,
      payCommission,
      variablePrice,
      composition,
      service,
      hasGrid,
      usePriceTable,
      fuel,
      useImei,
      stockByGrid,
      showInApp,
      // Impostos
      cfopInterno: formatCFOP(cfopInterno) || null,
      cstIcmsInterno: useCsosn ? null : (cstIcmsInterno || null),
      csosnInterno: useCsosn ? (csosnInterno || null) : null,
      aliqIcmsInterno: percentToNumber(aliqIcmsInterno),
      cfopExterno: formatCFOP(cfopExterno) || null,
      cstIcmsExterno: useCsosn ? null : (cstIcmsExterno || null),
      csosnExterno: useCsosn ? (csosnExterno || null) : null,
      aliqIcmsExterno: percentToNumber(aliqIcmsExterno),
      cstPisEntrada: cstPisEntrada || null,
      cstPisSaida: cstPisSaida || null,
      aliqPisPercent: percentToNumber(aliqPisPercent),
      aliqCofinsPercent: percentToNumber(aliqCofinsPercent),
      cstIpi: cstIpi || null,
      aliqIpiPercent: percentToNumber(aliqIpiPercent),
      fcpPercent: percentToNumber(fcpPercent),
      mvaPercent: percentToNumber(mvaPercent),
      baseReduzidaPercent: percentToNumber(baseReduzidaPercent),
      ncm: formatNCM(ncm) || null,
      ncmDescription: ncmDescription || null,
      cest: formatCEST(cest) || null,
    };
    try {
      setSaving(true);
      // Debug: log payload
      // eslint-disable-next-line no-console
      console.log('[Produtos] Salvando produto', payload);
      // Safety timeout para evitar travar indefinidamente
      const timeoutMs = 20000;
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao salvar produto (20s)')), timeoutMs));
      await Promise.race([onSave(payload), timeout]);
      toast({ title: 'Produto salvo', description: 'O produto foi salvo com sucesso.', variant: 'success', duration: 4000, className: 'bg-amber-500 text-black shadow-xl' });
      onOpenChange(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Produtos] Erro ao salvar', err);
      const m = mapDbErrorToMessage(err, { action: 'save' });
      toast({ title: m.title, description: m.description, variant: 'destructive', duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  // Reset saving state whenever the dialog opens/closes to avoid stuck UI
  useEffect(() => {
    if (!open) {
      setSaving(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-[780px] max-h-[80vh] sm:max-h-[85vh] flex flex-col" onKeyDown={(ev) => {
        if (ev.key === 'F5') { ev.preventDefault(); handleSave(ev); }
        if (ev.key === 'Escape') { ev.preventDefault(); onOpenChange(false); }
      }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg sm:text-xl">{product ? 'Detalhes do Produto' : 'Novo Produto'}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">Preencha as informações e use as abas para navegar.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4 py-2 flex-1 overflow-y-auto pr-1 fx-scroll">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Select para Mobile */}
            <div className="sm:hidden mb-4">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dados">Dados</SelectItem>
                  <SelectItem value="estoque">Estoque</SelectItem>
                  <SelectItem value="preco">Preço e Lucro</SelectItem>
                  <SelectItem value="impostos">Impostos</SelectItem>
                  <SelectItem value="outras">Outras Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabs para Desktop */}
            <TabsList className="hidden sm:grid grid-cols-5 gap-1">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
              <TabsTrigger value="preco">Preço e Lucro</TabsTrigger>
              <TabsTrigger value="impostos">Impostos</TabsTrigger>
              <TabsTrigger value="outras">Outras Info</TabsTrigger>
            </TabsList>

            <div className="mt-2 text-[10px] sm:text-[11px] text-text-muted">* Campo obrigatório</div>

            <TabsContent value="dados" className="space-y-3 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="code" className="text-left sm:text-right text-xs sm:text-sm">Código <span className="text-text-muted text-[10px] sm:text-xs">(auto)</span></Label>
                <Input id="code" value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g, ''))} className="col-span-1 sm:col-span-3 text-sm" placeholder={suggestedCode || 'Ex.: 0001'} disabled={!editEnabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="name" className="text-left sm:text-right text-xs sm:text-sm">Descrição {(!name?.trim()) && (<span className="text-danger">*</span>)}</Label>
                <Input id="name" value={name} onChange={(e)=>setName(e.target.value)} className="col-span-1 sm:col-span-3 text-sm" disabled={!editEnabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="category" className="text-left sm:text-right text-xs sm:text-sm">Categoria</Label>
                <div className="col-span-3 flex gap-2 items-center">
                  <Select value={category} onValueChange={(v)=> editEnabled && setCategory(v)}>
                      <SelectTrigger className="w-full" disabled={!editEnabled}>
                          <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                          {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={() => setShowNewCategory((v) => !v)}
                    className="bg-amber-500 hover:bg-amber-400 text-black inline-flex items-center gap-2 whitespace-nowrap px-3"
                    title={showNewCategory ? 'Fechar' : 'Adicionar nova categoria'}
                    disabled={!editEnabled}
                  >
                    <span className="font-bold">+</span>
                    <span>Novo</span>
                  </Button>
                </div>
              </div>
              {showNewCategory && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="col-span-1"/>
                  <div className="col-span-3 flex gap-2">
                    <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nome da nova categoria" />
                    <Button
                      type="button"
                      onClick={async () => {
                        const name = newCategory.trim();
                        if (!name) return;
                        try {
                          if (categories.includes(name)) {
                            toast({ title: 'Categoria já existe', description: 'Escolha outro nome.', variant: 'destructive' });
                            return;
                          }
                          await onCreateCategory?.(name);
                          setCategory(name);
                          setNewCategory('');
                          setShowNewCategory(false);
                          toast({ title: 'Categoria adicionada', description: 'Ela já está selecionada no formulário.', variant: 'success', className: 'bg-amber-500 text-black shadow-xl' });
                        } catch (err) {
                          // eslint-disable-next-line no-console
                          console.error('[Produto] add category inline:error', err);
                          const m = mapDbErrorToMessage(err, { action: 'save' });
                          toast({ title: m.title, description: m.description, variant: 'destructive' });
                        }
                      }}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="unit" className="text-left sm:text-right text-xs sm:text-sm">Unidade {(!unit?.trim()) && (<span className="text-danger">*</span>)}</Label>
                <Select value={unit} onValueChange={(v)=> editEnabled && setUnit(v)}>
                  <SelectTrigger className="col-span-1 sm:col-span-3 text-sm" disabled={!editEnabled}>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">UN - Unidade</SelectItem>
                    <SelectItem value="CX">CX - Caixa</SelectItem>
                    <SelectItem value="PC">PC - Peça</SelectItem>
                    <SelectItem value="KG">KG - Quilograma</SelectItem>
                    <SelectItem value="G">G - Grama</SelectItem>
                    <SelectItem value="L">L - Litro</SelectItem>
                    <SelectItem value="ML">ML - Mililitro</SelectItem>
                    <SelectItem value="M">M - Metro</SelectItem>
                    <SelectItem value="M2">M² - Metro Quadrado</SelectItem>
                    <SelectItem value="M3">M³ - Metro Cúbico</SelectItem>
                    <SelectItem value="PAR">PAR - Par</SelectItem>
                    <SelectItem value="DZ">DZ - Dúzia</SelectItem>
                    <SelectItem value="FD">FD - Fardo</SelectItem>
                    <SelectItem value="SC">SC - Saco</SelectItem>
                    <SelectItem value="PT">PT - Pacote</SelectItem>
                    <SelectItem value="SERV">SERV - Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="text-left sm:text-right text-xs sm:text-sm">Tipo {(!type) && (<span className="text-danger">*</span>)}</Label>
                <Select value={type} onValueChange={(v)=> editEnabled && setType(v)}>
                  <SelectTrigger className="col-span-1 sm:col-span-3 text-sm" disabled={!editEnabled}>
                      <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="Venda">Produto para Venda</SelectItem>
                      <SelectItem value="Uso Interno">Produto de Uso Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="text-left sm:text-right text-xs sm:text-sm">Ativo</Label>
                <div className="col-span-1 sm:col-span-3">
                  {product ? (
                    <>
                      <Checkbox checked={active} onCheckedChange={(v)=>{ console.log('[ProdutosPage] Checkbox active mudou para:', v); setActive(!!v); }} disabled={!editEnabled} />
                      <span className="ml-2 text-xs sm:text-sm">Ativo</span>
                    </>
                  ) : (
                    <Select value={active ? 'ativo' : 'inativo'} onValueChange={(v)=>{ console.log('[ProdutosPage] Select active mudou para:', v); setActive(v === 'ativo'); }}>
                      <SelectTrigger className="w-full sm:w-48 text-sm" disabled={!editEnabled}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="barcode" className="text-left sm:text-right text-xs sm:text-sm">EAN-13</Label>
                <Input id="barcode" value={barcode} onChange={(e)=>setBarcode(formatEAN13(e.target.value))} className="col-span-1 sm:col-span-3 text-sm" placeholder="789..." disabled={!editEnabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="validade" className="text-left sm:text-right text-xs sm:text-sm">Validade <span className="text-text-muted text-[10px] sm:text-xs">(Opcional)</span></Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "col-span-1 sm:col-span-3 justify-start text-left font-normal text-xs sm:text-sm",
                          !validade && "text-muted-foreground"
                        )}
                        disabled={!editEnabled}
                      >
                        <CalendarX className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        {validade ? format(validade, "dd/MM/yyyy") : <span>Selecione a data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[280px] sm:w-[300px]">
                      <div className="w-[280px] sm:w-[300px] min-h-[300px] sm:min-h-[332px]">
                        <Calendar mode="single" selected={validade} onSelect={setValidade} initialFocus fixedWeeks />
                      </div>
                    </PopoverContent>
                  </Popover>
              </div>
            </TabsContent>

            

            <TabsContent value="estoque" className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor="stock" className="text-right">Estoque</Label>
                  <Input
                    id="stock"
                    value={stock}
                    onChange={(e)=> setStock(e.target.value.replace(/[^0-9]/g, ''))}
                    disabled={!editEnabled}
                    className="col-span-1"
                    inputMode="numeric"
                  />
                </div>
                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="minStock" className="text-right">Estoque Mín.</Label>
                  <Input id="minStock" value={minStock} onChange={(e)=>setMinStock(e.target.value.replace(/[^0-9]/g, ''))} disabled={!editEnabled} inputMode="numeric" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preco" className="space-y-3 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="costPrice" className="text-xs sm:text-right">Preço de Custo (R$)</Label>
                <Input 
                  id="costPrice" 
                  inputMode="numeric" 
                  placeholder="Ex.: 10,00" 
                  value={`R$ ${costPrice || '0,00'}`} 
                  onChange={(e)=> {
                    setCostPrice(formatCurrencyBR(e.target.value));
                    // Mantém o último campo editado para recalcular corretamente
                  }} 
                  disabled={!editEnabled} 
                  className="sm:col-span-3 text-xs sm:text-sm" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="salePrice" className="text-xs sm:text-right">Preço de Venda (R$) {((!salePrice) || (currencyToNumber(salePrice) <= 0)) && (<span className="text-danger">*</span>)}</Label>
                <Input 
                  id="salePrice" 
                  inputMode="numeric" 
                  placeholder="Ex.: 15,00" 
                  value={`R$ ${salePrice || '0,00'}`} 
                  onChange={(e)=> {
                    lastEditedFieldRef.current = 'salePrice';
                    setSalePrice(formatCurrencyBR(e.target.value));
                  }} 
                  disabled={!editEnabled} 
                  className="sm:col-span-3 text-xs sm:text-sm" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="marginPercent" className="text-xs sm:text-right">% de Lucro (Margem)</Label>
                <Input 
                  id="marginPercent" 
                  type="text"
                  placeholder="Ex.: 40" 
                  value={marginPercent ? `% ${marginPercent}` : ''} 
                  onChange={(e)=> {
                    lastEditedFieldRef.current = 'marginPercent';
                    const cleaned = e.target.value.replace(/[^\d,]/g, '');
                    setMarginPercent(cleaned);
                  }}
                  onBlur={() => {
                    // Ao sair do campo, força recalculo imediato
                    if (lastEditedFieldRef.current === 'marginPercent') {
                      const cp = currencyToNumber(costPrice);
                      const m = percentToNumber(marginPercent);
                      if (cp > 0 && m > 0) {
                        if (m >= 100) {
                          // Markup para margem >= 100%
                          const sp = cp * (1 + m / 100);
                          setSalePrice(sp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        } else {
                          // Margem normal
                          const sp = cp / (1 - m / 100);
                          setSalePrice(sp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        }
                      }
                    }
                  }}
                  disabled={!editEnabled} 
                  className="sm:col-span-3 text-xs sm:text-sm" 
                />
              </div>
            </TabsContent>

            <TabsContent value="impostos" className="space-y-4 mt-2">
              <div className="flex items-center gap-3">
                <Checkbox id="useCsosn" checked={useCsosn} onCheckedChange={(v)=>setUseCsosn(!!v)} disabled={!editEnabled} />
                <Label htmlFor="useCsosn" className="cursor-pointer text-xs sm:text-sm">Usar CSOSN (Simples Nacional)</Label>
              </div>
              {/* ICMS - Interno/Externo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-semibold">ICMS - Operação Interna</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CFOP {(!cfopInterno?.trim()) && (<span className="text-danger">*</span>)}</Label>
                    <Input
                      value={cfopInterno}
                      onChange={(e)=>setCfopInterno(formatCFOP(e.target.value))}
                      className={cn(
                        "sm:col-span-3 text-xs sm:text-sm",
                        !cfopInterno?.trim() && "border-danger focus-visible:ring-danger/60"
                      )}
                      placeholder="5102"
                      disabled={!editEnabled}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CST</Label>
                    <Input
                      value={cstIcmsInterno}
                      onChange={(e)=>setCstIcmsInterno(e.target.value.toUpperCase())}
                      className="sm:col-span-3 text-xs sm:text-sm"
                      placeholder="00, 20, 40..."
                      disabled={!editEnabled || useCsosn}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CSOSN {useCsosn && !csosnInterno?.trim() && (<span className="text-danger">*</span>)}</Label>
                    <Select
                      value={csosnInterno}
                      onValueChange={(v)=> editEnabled && setCsosnInterno(v)}
                      disabled={!editEnabled || !useCsosn}
                    >
                      <SelectTrigger
                        className={cn(
                          "sm:col-span-3 text-xs sm:text-sm",
                          useCsosn && !csosnInterno?.trim() && "border-danger focus-visible:ring-danger/60"
                        )}
                      >
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CSOSN_OPTIONS.map(code => (
                          <SelectItem key={code} value={code}>{code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">Alíquota ICMS (%)</Label>
                    <Input value={`${aliqIcmsInterno || ''}`} onChange={(e)=>setAliqIcmsInterno(formatPercent(e.target.value))} className="sm:col-span-3 text-xs sm:text-sm" placeholder="0,00" disabled={!editEnabled} />
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-semibold">ICMS - Operação Externa</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CFOP {(!cfopExterno?.trim()) && (<span className="text-danger">*</span>)}</Label>
                    <Input
                      value={cfopExterno}
                      onChange={(e)=>setCfopExterno(formatCFOP(e.target.value))}
                      className={cn(
                        "sm:col-span-3 text-xs sm:text-sm",
                        !cfopExterno?.trim() && "border-danger focus-visible:ring-danger/60"
                      )}
                      placeholder="6102"
                      disabled={!editEnabled}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CST</Label>
                    <Input
                      value={cstIcmsExterno}
                      onChange={(e)=>setCstIcmsExterno(e.target.value.toUpperCase())}
                      className="sm:col-span-3 text-xs sm:text-sm"
                      placeholder="00, 20, 40..."
                      disabled={!editEnabled || useCsosn}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CSOSN</Label>
                    <Select
                      value={csosnExterno}
                      onValueChange={(v)=> editEnabled && setCsosnExterno(v)}
                      disabled={!editEnabled || !useCsosn}
                    >
                      <SelectTrigger className="sm:col-span-3 text-xs sm:text-sm">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CSOSN_OPTIONS.map(code => (
                          <SelectItem key={code} value={code}>{code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">Alíquota ICMS (%)</Label>
                    <Input value={`${aliqIcmsExterno || ''}`} onChange={(e)=>setAliqIcmsExterno(formatPercent(e.target.value))} className="sm:col-span-3 text-xs sm:text-sm" placeholder="0,00" disabled={!editEnabled} />
                  </div>
                </div>
              </div>

              {/* PIS/COFINS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-semibold">PIS/COFINS</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CST PIS Entrada</Label>
                    <Input value={cstPisEntrada} onChange={(e)=>setCstPisEntrada(e.target.value.toUpperCase())} className="sm:col-span-3 text-xs sm:text-sm" placeholder="50, 70..." disabled={!editEnabled} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CST PIS Saída</Label>
                    <Input value={cstPisSaida} onChange={(e)=>setCstPisSaida(e.target.value.toUpperCase())} className="sm:col-span-3 text-xs sm:text-sm" placeholder="01, 04..." disabled={!editEnabled} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">Alíquota PIS (%)</Label>
                    <Input value={`${aliqPisPercent || ''}`} onChange={(e)=>setAliqPisPercent(formatPercent(e.target.value))} className="sm:col-span-3 text-xs sm:text-sm" placeholder="0,65" disabled={!editEnabled} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">Alíquota COFINS (%)</Label>
                    <Input value={`${aliqCofinsPercent || ''}`} onChange={(e)=>setAliqCofinsPercent(formatPercent(e.target.value))} className="sm:col-span-3 text-xs sm:text-sm" placeholder="3,00" disabled={!editEnabled} />
                  </div>
                </div>
                {/* IPI */}
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-semibold">IPI</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">CST IPI</Label>
                    <Input value={cstIpi} onChange={(e)=>setCstIpi(e.target.value.toUpperCase())} className="sm:col-span-3 text-xs sm:text-sm" placeholder="50, 99..." disabled={!editEnabled} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="text-xs sm:text-right">Alíquota IPI (%)</Label>
                    <Input value={`${aliqIpiPercent || ''}`} onChange={(e)=>setAliqIpiPercent(formatPercent(e.target.value))} className="sm:col-span-3 text-xs sm:text-sm" placeholder="0,00" disabled={!editEnabled} />
                  </div>
                </div>
              </div>

              {/* FCP/MVA/Base Reduzida */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 items-start sm:items-center gap-2 sm:gap-4">
                  <Label className="text-xs sm:text-right">FCP (%)</Label>
                  <Input value={`${fcpPercent || ''}`} onChange={(e)=>setFcpPercent(formatPercent(e.target.value))} placeholder="2,00" disabled={!editEnabled} className="text-xs sm:text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 items-start sm:items-center gap-2 sm:gap-4">
                  <Label className="text-xs sm:text-right">MVA (%)</Label>
                  <Input value={`${mvaPercent || ''}`} onChange={(e)=>setMvaPercent(formatPercent(e.target.value))} placeholder="40,00" disabled={!editEnabled} className="text-xs sm:text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 items-start sm:items-center gap-2 sm:gap-4">
                  <Label className="text-xs sm:text-right">Base Reduzida (%)</Label>
                  <Input value={`${baseReduzidaPercent || ''}`} onChange={(e)=>setBaseReduzidaPercent(formatPercent(e.target.value))} placeholder="0,00" disabled={!editEnabled} className="text-xs sm:text-sm" />
                </div>
              </div>

              {/* NCM/CEST */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 items-start sm:items-center gap-2 sm:gap-4">
                  <Label className="text-xs sm:text-right">NCM {(!ncm?.trim()) && (<span className="text-danger">*</span>)}</Label>
                  <Input
                    value={ncm}
                    onChange={(e)=>setNcm(formatNCM(e.target.value))}
                    placeholder="00000000"
                    disabled={!editEnabled}
                    className={cn(
                      "text-xs sm:text-sm",
                      !ncm?.trim() && "border-danger focus-visible:ring-danger/60"
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 items-start sm:items-center gap-2 sm:gap-4">
                  <Label className="text-xs sm:text-right">CEST</Label>
                  <Input value={cest} onChange={(e)=>setCest(formatCEST(e.target.value))} placeholder="0000000" disabled={!editEnabled} className="text-xs sm:text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 items-start sm:items-center gap-2 sm:gap-4 sm:col-span-2">
                  <Label className="text-xs sm:text-right">Descrição NCM</Label>
                  <Input value={ncmDescription} onChange={(e)=>setNcmDescription(e.target.value)} placeholder="Descrição do NCM" disabled={!editEnabled} className="text-sm" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="outras" className="space-y-3 mt-2">
              {/* Botão para Modal Integrado */}
              {product && (
                <div className="pb-4 mb-4 border-b border-border">
                  <Button
                    type="button"
                    onClick={() => setShowDismemberModal(true)}
                    disabled={!editEnabled}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Desmembrar e Unir Produto
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Divida o preço por quantidade e opcionalmente una com outro produto
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="barcode2" className="text-xs sm:text-right">Código de Barras</Label>
                <Input id="barcode2" value={barcode} onChange={(e)=>setBarcode(formatEAN13(e.target.value))} className="sm:col-span-3 text-xs sm:text-sm" placeholder="EAN-13" disabled={!editEnabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="barcodeBox" className="text-xs sm:text-right">Código Barras (Caixa)</Label>
                <Input id="barcodeBox" value={barcodeBox} onChange={(e)=>setBarcodeBox(formatEAN13(e.target.value))} className="sm:col-span-3 text-xs sm:text-sm" placeholder="EAN-13 da caixa" disabled={!editEnabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="reference" className="text-xs sm:text-right">Referência</Label>
                <Input id="reference" value={reference} onChange={(e)=>setReference(e.target.value)} className="sm:col-span-3 text-xs sm:text-sm" placeholder="Ex.: REF-123" disabled={!editEnabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="brand" className="text-xs sm:text-right">Marca</Label>
                <Input id="brand" value={brand} onChange={(e)=>setBrand(e.target.value)} className="sm:col-span-3 text-xs sm:text-sm" placeholder="Ex.: Nike" disabled={!editEnabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="group" className="text-xs sm:text-right">Grupo</Label>
                <Input id="group" value={group} onChange={(e)=>setGroup(e.target.value)} className="sm:col-span-3 text-xs sm:text-sm" placeholder="Ex.: Calçados" disabled={!editEnabled} />
              </div>
            </TabsContent>

            {false && (
              <TabsContent value="param" className="space-y-3 mt-2" />
            )}
          </Tabs>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving || !editEnabled} title="F5 para salvar">
            {saving ? 'Salvando...' : 'Salvar Produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Modal Integrado: Desmembrar e Unir */}
      <DismemberAndMergeModal
        open={showDismemberModal}
        onOpenChange={setShowDismemberModal}
        product={product}
        currentPrice={salePrice}
        allProducts={products}
        userProfile={userProfile}
        onApply={async (unitPrice, quantity, targetProduct, updatePrice) => {
          if (!targetProduct) {
            // Apenas desmembrar
            setSalePrice(unitPrice);
            setStock(quantity);
            setShowDismemberModal(false);
            toast({ 
              title: 'Preço desmembrado!', 
              description: `Preço unitário: R$ ${currencyToNumber(unitPrice).toFixed(2)} | Estoque: ${quantity}`, 
              variant: 'success' 
            });
          } else {
            // Desmembrar E unir
            try {
              const delta = Number(quantity);
              const adj = await adjustProductStock({ 
                productId: targetProduct.id, 
                delta, 
                codigoEmpresa: userProfile?.codigo_empresa 
              });
              const newStock = Number(adj?.stock ?? (Number(targetProduct.stock || 0) + delta));
              
              if (updatePrice) {
                const priceUpdate = { 
                  ...targetProduct, 
                  stock: newStock, 
                  salePrice: currencyToNumber(unitPrice), 
                  price: currencyToNumber(unitPrice)
                };
                await updateProduct(targetProduct.id, priceUpdate);
              }
              
              await deleteProduct(product.id);
              
              toast({ 
                title: 'Produto desmembrado e unido!', 
                description: `${targetProduct.name}: novo estoque = ${newStock} | preço unitário = R$ ${currencyToNumber(unitPrice).toFixed(2)}`, 
                variant: 'success' 
              });
              
              setShowDismemberModal(false);
              onOpenChange(false);
              try { typeof onRefreshProducts === 'function' && onRefreshProducts(); } catch {}
            } catch (err) {
              console.error('[Desmembrar e Unir] Erro:', err);
              toast({ 
                title: 'Erro ao processar', 
                description: err?.message || 'Tente novamente', 
                variant: 'destructive' 
              });
            }
          }
        }}
      />
    </Dialog>
  );
}

// Modal Integrado: Desmembrar e Unir Produtos
function DismemberAndMergeModal({ open, onOpenChange, product, currentPrice, allProducts, userProfile, onApply }) {
  const [total, setTotal] = useState('');
  const [quantity, setQuantity] = useState('');
  const [wantToMerge, setWantToMerge] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [updatePrice, setUpdatePrice] = useState(false);
  
  const formatCurrencyBR = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    const number = digits ? Number(digits) / 100 : 0;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const currencyToNumber = (value) => {
    if (!value) return 0;
    const normalized = String(value).replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };
  
  useEffect(() => {
    if (open && currentPrice) {
      setTotal(currentPrice);
      setQuantity('');
      setWantToMerge(false);
      setSearchTerm('');
      setSelectedProduct(null);
      setUpdatePrice(false);
    }
  }, [open, currentPrice]);
  
  const unitPrice = total && quantity && Number(quantity) > 0 
    ? currencyToNumber(total) / Number(quantity) 
    : 0;
  
  const filteredProducts = (allProducts || [])
    .filter(p => {
      if (!product || p.id === product.id) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (p.name || '').toLowerCase().includes(term) || 
             (p.code || '').toLowerCase().includes(term);
    })
    .slice(0, 10);
  
  const newStock = selectedProduct 
    ? Number(quantity || 0) + Number(selectedProduct.stock || 0)
    : 0;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[650px] max-h-[85vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Desmembrar e Unir Produto</DialogTitle>
          <DialogDescription>
            Divida o preço por quantidade e opcionalmente una com outro produto
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Passo 1: Desmembrar */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">1. Desmembrar Preço</h3>
            <div className="space-y-2">
              <Label>Valor Total (R$)</Label>
              <Input 
                inputMode="numeric" 
                placeholder="0,00" 
                value={`R$ ${total || '0,00'}`}
                onChange={(e) => setTotal(formatCurrencyBR(e.target.value))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Quantidade de Unidades</Label>
              <Input 
                type="text"
                inputMode="numeric"
                placeholder="0" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
            
            {unitPrice > 0 && (
              <div className="bg-muted/50 border border-border p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Preço Unitário:</span>
                  <span className="text-lg font-bold">R$ {unitPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Passo 2: Unir (Opcional) */}
          {unitPrice > 0 && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="wantToMerge" 
                  checked={wantToMerge} 
                  onCheckedChange={(v) => {
                    setWantToMerge(!!v);
                    if (!v) {
                      setSelectedProduct(null);
                      setSearchTerm('');
                      setUpdatePrice(false);
                    }
                  }} 
                />
                <Label htmlFor="wantToMerge" className="cursor-pointer text-sm font-semibold">
                  2. Unir com outro produto (opcional)
                </Label>
              </div>
              
              {wantToMerge && (
                <div className="space-y-3 ml-6">
                  <div className="bg-muted/30 border border-border p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <strong>Produto atual:</strong> {product?.name} (será inativado após união)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Buscar Produto Destino</Label>
                    <Input 
                      placeholder="Digite o nome ou código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Produtos Disponíveis ({filteredProducts.length})</Label>
                    <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                      {filteredProducts.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2 text-center">
                          Nenhum produto encontrado
                        </p>
                      ) : (
                        filteredProducts.map(p => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className={cn(
                              "p-2 rounded-md cursor-pointer border transition-colors",
                              selectedProduct?.id === p.id
                                ? "bg-primary/10 border-primary"
                                : "bg-background hover:bg-muted/50 border-transparent"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {p.code && `Código: ${p.code} • `}
                                  Estoque: {p.stock || 0} • R$ {Number(p.price || p.salePrice || 0).toFixed(2)}
                                </p>
                              </div>
                              {selectedProduct?.id === p.id && (
                                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {selectedProduct && (
                    <div className="space-y-2">
                      <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
                        <p className="text-xs font-medium mb-1">Resumo da União:</p>
                        <div className="text-xs space-y-0.5 text-muted-foreground">
                          <p>• Destino: <strong>{selectedProduct.name}</strong></p>
                          <p>• Estoque atual: {selectedProduct.stock || 0}</p>
                          <p>• Estoque a somar: +{quantity}</p>
                          <p className="text-primary font-bold">→ Novo estoque: {newStock}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="updatePrice" 
                          checked={updatePrice} 
                          onCheckedChange={(v) => setUpdatePrice(!!v)} 
                        />
                        <Label htmlFor="updatePrice" className="cursor-pointer text-xs">
                          Atualizar preço do destino para R$ {unitPrice.toFixed(2)}
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => {
              if (unitPrice > 0) {
                const formattedPrice = unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                onApply(formattedPrice, quantity, wantToMerge ? selectedProduct : null, updatePrice);
              }
            }}
            disabled={unitPrice <= 0 || (wantToMerge && !selectedProduct)}
          >
            {wantToMerge && selectedProduct ? 'Desmembrar e Unir' : 'Aplicar Desmembramento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManagerModal({ open, onOpenChange, categories, onAddCategory, onRemoveCategory }) {
    const { toast } = useToast();
    const [newCategory, setNewCategory] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAdd = async () => {
        const name = newCategory.trim();
        if (!name) return;
        if (categories.includes(name)) {
          toast({ title: 'Categoria já existe', description: 'Escolha outro nome.', variant: 'destructive' });
          return;
        }
        try {
          setLoading(true);
          await onAddCategory(name);
          setNewCategory('');
          toast({ title: 'Categoria adicionada', description: 'Ela já aparece na lista.', variant: 'success', className: 'bg-amber-500 text-black shadow-xl' });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[Categorias] add:error', err);
          const m = mapDbErrorToMessage(err, { action: 'save' });
          toast({ title: m.title, description: m.description, variant: 'destructive' });
        } finally {
          setLoading(false);
        }
    };

    const handleRemove = async (catToRemove) => {
        try {
          setLoading(true);
          await onRemoveCategory(catToRemove);
          toast({ title: 'Categoria desativada', description: 'A categoria foi marcada como inativa.', variant: 'success', className: 'bg-amber-500 text-black shadow-xl' });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[Categorias] remove:error', err);
          const m = mapDbErrorToMessage(err, { action: 'save' });
          toast({ title: m.title, description: m.description, variant: 'destructive' });
        } finally {
          setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Gerenciar Categorias</DialogTitle>
                    <DialogDescription>Adicione ou remova categorias de produtos.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            value={newCategory} 
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Nome da nova categoria"
                        />
                        <Button onClick={handleAdd} disabled={loading}>{loading ? 'Processando...' : 'Adicionar'}</Button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {categories.map(cat => (
                            <div key={cat} className="flex items-center justify-between bg-surface-2 p-2 rounded-md">
                                <span className="font-semibold">{cat}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger/80 hover:text-danger" onClick={() => handleRemove(cat)} disabled={loading}>
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ProdutosPage() {
    const { toast } = useToast();
    const { userProfile, authReady } = useAuth();
    const location = useLocation();
    const [products, setProducts] = useState(initialProducts);
    const [categories, setCategories] = useState(initialCategories);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [suggestedCode, setSuggestedCode] = useState('');

    const [viewMode, setViewMode] = useState('list');
    const [showStats, setShowStats] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ type: 'all', category: 'all', status: 'active', newOnly: false });
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    // Ordenação: by: 'code' | 'name' | 'validade'; dir: 'asc' | 'desc'
    const [sort, setSort] = useState({ by: 'code', dir: 'asc' });

    // Sem persistência por enquanto

    const mountedRef = useRef(true);
    const lastLoadTsRef = useRef(0);
    const lastSizeRef = useRef(0);
    const retryOnceRef = useRef(false);
    const [showConfig, setShowConfig] = useState(false);
    const [listMode, setListMode] = useState('paged');
    const usePagination = listMode === 'paged';
    const [page, setPage] = useState(1);
    const [pageSize] = useState(100);
    const [totalCount, setTotalCount] = useState(0);
    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

    // Carregar configurações iniciais (modo de listagem, estatísticas) de localStorage
    useEffect(() => {
      try {
        const raw = localStorage.getItem(PRODUTOS_SETTINGS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.listMode === 'paged' || parsed.listMode === 'all') {
            setListMode(parsed.listMode);
          }
          if (typeof parsed.showStats === 'boolean') {
            setShowStats(parsed.showStats);
          }
        }
      } catch {
        // ignora erros de leitura
      }
    }, []);

    // Carregar configurações do banco (sobrepõe localStorage)
    useEffect(() => {
      const loadFromDb = async () => {
        if (!userProfile?.codigo_empresa || !userProfile?.id && !userProfile?.user_id) return;
        const userId = userProfile.id || userProfile.user_id;
        const scope = `produtos:${userProfile.codigo_empresa}`;
        const settings = await getUserUISettings({ userId, scope });
        if (!settings) return;
        if (settings.listMode === 'paged' || settings.listMode === 'all') {
          setListMode(settings.listMode);
        }
        if (typeof settings.showStats === 'boolean') {
          setShowStats(settings.showStats);
        }
      };
      loadFromDb();
    }, [userProfile?.codigo_empresa, userProfile?.id]);

    // Persistir configurações sempre que mudarem
    useEffect(() => {
      try {
        const payload = { listMode, showStats };
        localStorage.setItem(PRODUTOS_SETTINGS_KEY, JSON.stringify(payload));
      } catch {
        // ignore
      }
      if (userProfile?.codigo_empresa && (userProfile?.id || userProfile?.user_id)) {
        const userId = userProfile.id || userProfile.user_id;
        const scope = `produtos:${userProfile.codigo_empresa}`;
        saveUserUISettings({ userId, scope, settings: { listMode, showStats } });
      }
    }, [listMode, showStats, userProfile?.codigo_empresa, userProfile?.id]);

    const refetchProducts = async () => {
      const codigoEmpresa = userProfile?.codigo_empresa || null;
      if (!authReady || !codigoEmpresa) return; // aguarda auth
      const cacheKey = `produtos:list:${codigoEmpresa}`;
      setLoading(true);
      const slowFallback = setTimeout(() => {
        if (!mountedRef.current) return;
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          if (Array.isArray(cached) && cached.length > 0) {
            console.warn('[Produtos] slow fallback: using cached snapshot');
            setProducts(cached);
          }
        } catch {}
      }, 2000);
      try {
        const includeInactive = filters.status === 'all' || filters.status === 'inactive';
        let data = [];
        if (usePagination) {
          console.log('[Produtos] refetchProducts - modo paginado - Filtro status:', filters.status, 'includeInactive:', includeInactive, 'page:', page, 'pageSize:', pageSize);
          const result = await listProductsPaged({ includeInactive, search: searchTerm, codigoEmpresa, page, pageSize });
          if (!mountedRef.current) return;
          data = result?.data || [];
          const count = result?.count || 0;
          console.log('[Produtos] refetchProducts - Produtos carregados (paginado):', data.length, 'de', count);
          setProducts(data);
          setTotalCount(count);
        } else {
          console.log('[Produtos] refetchProducts - modo TODOS - Filtro status:', filters.status, 'includeInactive:', includeInactive);
          data = await listProducts({ includeInactive, search: searchTerm, codigoEmpresa });
          if (!mountedRef.current) return;
          console.log('[Produtos] refetchProducts - Produtos carregados (todos):', data.length);
          setProducts(data);
          setTotalCount(data.length);
        }
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
        lastSizeRef.current = data.length;
        lastLoadTsRef.current = Date.now();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Produtos] refetchProducts:error', err);
        const m = mapDbErrorToMessage(err, { action: 'fetch' });
        toast({ title: m.title, description: m.description, variant: 'destructive' });
      } finally {
        clearTimeout(slowFallback);
        setLoading(false);
      }
    };

    // Carrega na montagem (com cache imediato) e quando auth estiver pronta
    useEffect(() => {
      // descobrir codigo_empresa do userProfile ou do cache do auth
      const cachedCodigo = (() => {
        try {
          const raw = localStorage.getItem('auth:userProfile');
          return raw ? (JSON.parse(raw)?.codigo_empresa || null) : null;
        } catch { return null; }
      })();
      const codigoEmpresa = userProfile?.codigo_empresa || cachedCodigo;
      if (!codigoEmpresa) return;
      const cacheKey = `produtos:list:${codigoEmpresa}`;

      // hydrate cache products imediatamente
      const cached = (() => {
        try { return JSON.parse(localStorage.getItem(cacheKey) || '[]'); } catch { return []; }
      })();
      if (Array.isArray(cached) && cached.length > 0) {
        setProducts(cached);
        lastSizeRef.current = cached.length;
      }
      
      // load fresh data in background com retry
      const loadWithRetry = async (attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
          try {
            if (mountedRef.current) {
              await refetchProducts();
              break;
            }
          } catch (err) {
            console.warn(`[ProdutosPage] Tentativa ${i + 1} falhou:`, err);
            if (i === attempts - 1) {
              console.error('[ProdutosPage] Todas as tentativas falharam');
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        }
      };
      
      // Carregar categorias em cache
      try {
        const cachedCats = JSON.parse(localStorage.getItem(`produtos:cats:${codigoEmpresa}`) || '[]');
        if (Array.isArray(cachedCats) && cachedCats.length > 0) setCategories(cachedCats);
      } catch {}
      
      if (authReady && userProfile?.codigo_empresa) {
        const t = setTimeout(() => loadWithRetry(), 100);
        
        // Carregar categorias
        (async () => {
          try {
            const cats = await listCategories({ codigoEmpresa: userProfile.codigo_empresa });
            if (!mountedRef.current) return;
            setCategories(cats);
            try { localStorage.setItem(`produtos:cats:${userProfile.codigo_empresa}`, JSON.stringify(cats)); } catch {}
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[Categorias] load on mount:error', err);
          }
        })();
        
        return () => clearTimeout(t);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, userProfile?.codigo_empresa]);

    // Recarregar ao focar/ficar visível se estiver estagnado
    useEffect(() => {
      const onFocus = () => {
        const elapsed = Date.now() - (lastLoadTsRef.current || 0);
        if (elapsed > 30000 || lastSizeRef.current === 0) refetchProducts();
      };
      const onVis = () => {
        if (document.visibilityState === 'visible') {
          const elapsed = Date.now() - (lastLoadTsRef.current || 0);
          if (elapsed > 30000 || lastSizeRef.current === 0) refetchProducts();
        }
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVis);
      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVis);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, userProfile?.codigo_empresa]);

    // Quando o filtro de status muda, refetch para incluir/ocultar inativos no backend
    useEffect(() => {
      setPage(1);
      if (authReady) refetchProducts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, authReady]);

    // Debounce da busca
    useEffect(() => {
      const t = setTimeout(() => {
        setPage(1);
        if (authReady) refetchProducts();
      }, 300);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, authReady]);

    useEffect(() => {
      setPage(1);
      if (authReady) refetchProducts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listMode, authReady]);

    // Trazer "mais vendido do dia" do backend
    const [mostSoldToday, setMostSoldToday] = useState('N/A');
    useEffect(() => {
      let active = true;
      (async () => {
        try {
          const items = await getMostSoldProductsToday({ limit: 1, codigoEmpresa: userProfile?.codigo_empresa });
          if (!active) return;
          if (Array.isArray(items) && items.length > 0) {
            const top = items[0];
            setMostSoldToday(`${top.name} (${top.total})`);
          } else {
            setMostSoldToday('—');
          }
        } catch {
          if (active) setMostSoldToday('N/A');
        }
      })();
      return () => { active = false; };
    }, [userProfile?.codigo_empresa]);

    // Modal: Vendas por Período (acionado pelo card "Mais Vendido (Dia)")
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [salesFrom, setSalesFrom] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
    
    // XML Import
    const [isXmlImportOpen, setIsXmlImportOpen] = useState(false);
    const [salesTo, setSalesTo] = useState(() => new Date());
    const [salesLoading, setSalesLoading] = useState(false);
    const [salesItems, setSalesItems] = useState([]); // [{id,name,total}]
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    const loadSales = async () => {
      try {
        setSalesLoading(true);
        const items = await getSoldProductsByPeriod({ from: salesFrom, to: salesTo, codigoEmpresa: userProfile?.codigo_empresa });
        setSalesItems(items || []);
      } catch (err) {
        toast({ title: 'Falha ao carregar vendas do período', description: err?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setSalesLoading(false);
      }
    };

    const stats = useMemo(() => {
        const today = new Date();
        return {
            mostSold: mostSoldToday,
            lowStock: products.filter(p => p.status === 'low_stock' || (p.stock > 0 && p.stock <= p.minStock)).length,
            expired: products.filter(p => p.validade && p.validade < today).length
        }
    }, [products, mostSoldToday]);

    const filteredProducts = useMemo(() => {
        const today = new Date();
        return products.filter(p => {
            const cardFilterMatch = 
                activeFilter === 'all' ? true :
                activeFilter === 'low_stock' ? (p.status === 'low_stock' || (p.stock > 0 && p.stock <= p.minStock)) :
                activeFilter === 'expired' ? (p.validade && p.validade < today) :
                false;

            // Regra: quando status = 'all', mostra todos incluindo inativos
            const statusMatch = filters.status === 'all'
              ? true
              : (p.status === filters.status);

            const typeMatch = (filters.type === 'all' || p.type === filters.type);
            const categoryMatch = (filters.category === 'all' || p.category === filters.category);
            
            // Filtro de produtos novos (importados nos últimos 7 dias)
            const newMatch = !filters.newOnly || (p.dataImportacao && (() => {
              const daysSince = Math.floor((new Date() - p.dataImportacao) / (1000 * 60 * 60 * 24));
              return daysSince <= 7;
            })());

            return cardFilterMatch && statusMatch && typeMatch && categoryMatch && newMatch;
        });
    }, [products, activeFilter, filters]);

    // Helper: produto é considerado "Novo" se dataImportacao for até 7 dias atrás
    const isProductNew = (produto) => {
      if (!produto?.dataImportacao) return false;
      const daysSince = Math.floor((new Date() - produto.dataImportacao) / (1000 * 60 * 60 * 24));
      return daysSince <= 7;
    };

    // Ordena os produtos filtrados conforme cabeçalho clicado
    const sortedProducts = useMemo(() => {
      const arr = [...filteredProducts];
      const dir = sort.dir === 'asc' ? 1 : -1;
      const safeNum = (n, fallback) => (Number.isFinite(n) ? n : fallback);
      const parseDate = (v) => {
        if (!v) return NaN;
        if (v instanceof Date) return v.getTime();
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? NaN : d.getTime();
      };
      arr.sort((a, b) => {
        if (sort.by === 'code') {
          const an = safeNum(parseInt((a.code || '').trim(), 10), Infinity);
          const bn = safeNum(parseInt((b.code || '').trim(), 10), Infinity);
          if (an === bn) return 0;
          return an > bn ? dir : -dir;
        }
        if (sort.by === 'name') {
          const an = (a.name || '').toString();
          const bn = (b.name || '').toString();
          const cmp = an.localeCompare(bn, 'pt-BR', { sensitivity: 'base' });
          return cmp * dir;
        }
        if (sort.by === 'validade') {
          const ad = safeNum(parseDate(a.validade), Infinity);
          const bd = safeNum(parseDate(b.validade), Infinity);
          if (ad === bd) return 0;
          return ad > bd ? dir : -dir; // asc: mais próximo de vencer primeiro
        }
        return 0;
      });
      return arr;
    }, [filteredProducts, sort]);

    const totalPages = useMemo(() => {
      if (!pageSize) return 1;
      const pages = Math.ceil((totalCount || 0) / pageSize);
      return pages > 0 ? pages : 1;
    }, [totalCount, pageSize]);

    const toggleSort = (by) => {
      setSort(prev => prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' });
    };

    const handleStatCardClick = (filter) => {
        setActiveFilter(prev => prev === filter ? 'all' : filter);
    };
    const handleOpenSalesModal = () => {
      setSalesFrom(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
      setSalesTo(new Date());
      setIsSalesModalOpen(true);
      // carrega automaticamente para o dia atual
      setTimeout(loadSales, 0);
    };
    
    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({...prev, [filterType]: value}));
    };

    // Import removido nesta versão

    const handleAddNew = async () => {
      setSelectedProduct(null);
      // Buscar código sugerido no backend (menor código livre), mas não bloquear abertura se falhar
      const codigoEmpresa = userProfile?.codigo_empresa || null;
      let initialCode = '';
      if (codigoEmpresa) {
        try {
          initialCode = await getNextProductCode({ codigoEmpresa });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[Produtos] handleAddNew: falha ao obter próximo código', err);
        }
      }
      // Abre o formulário; ProductFormModal vai usar suggestedCode como placeholder/valor inicial
      setSuggestedCode(initialCode || '');
      setIsFormOpen(true);
    };

    const handleEdit = (product) => {
        setSelectedProduct(product);
        setIsFormOpen(true);
    };

    const handleExport = () => {
      try {
        downloadProductsCsv(sortedProducts);
        toast({ title: 'Exportação concluída', description: `${sortedProducts.length} produto(s) exportado(s).`, variant: 'success', className: 'bg-amber-500 text-black shadow-xl' });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Produtos] export:error', err);
        const m = mapDbErrorToMessage(err, { action: 'export' });
        toast({ title: m.title, description: m.description, variant: 'destructive' });
      }
    };

    // ===== Seleção múltipla & ações em massa =====
    const handleToggleSelectProduct = (id) => {
      setSelectedProductIds((prev) =>
        prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
      );
    };

    const handleSelectAllFiltered = () => {
      const filteredIds = sortedProducts.map((p) => p.id);
      if (!filteredIds.length) return;
      setSelectedProductIds(filteredIds);
    };

    const handleClearSelection = () => {
      setSelectedProductIds([]);
    };

    const handleToggleSelectAllVisible = (checked) => {
      if (checked) {
        handleSelectAllFiltered();
      } else {
        handleClearSelection();
      }
    };

    const selectedProducts = useMemo(
      () => sortedProducts.filter((p) => selectedProductIds.includes(p.id)),
      [sortedProducts, selectedProductIds]
    );

    const hasNewSelected = useMemo(
      () => selectedProducts.some(isProductNew),
      [selectedProducts]
    );

    const handleBulkStatusChange = async (status) => {
      if (!selectedProductIds.length) return;
      try {
        await bulkUpdateProductStatus({ ids: selectedProductIds, status });
        await refetchProducts();
        handleClearSelection();
        toast({
          title: status === 'inactive' ? 'Produtos inativados' : 'Produtos atualizados',
          description: `${selectedProductIds.length} produto(s) atualizado(s).`,
          variant: 'success',
          className: 'bg-amber-500 text-black shadow-xl',
        });
      } catch (err) {
        const m = mapDbErrorToMessage(err, { action: 'save' });
        toast({ title: m.title, description: m.description, variant: 'destructive' });
      }
    };

    const handleBulkClearNewFlag = async () => {
      if (!selectedProductIds.length || !hasNewSelected) return;
      try {
        await bulkClearNewFlag({ ids: selectedProductIds });
        await refetchProducts();
        handleClearSelection();
        toast({
          title: 'Novos removidos',
          description: 'A etiqueta de novo foi removida dos produtos selecionados.',
          variant: 'success',
          className: 'bg-amber-500 text-black shadow-xl',
        });
      } catch (err) {
        const m = mapDbErrorToMessage(err, { action: 'save' });
        toast({ title: m.title, description: m.description, variant: 'destructive' });
      }
    };

    // -------- Categorias backend handlers --------
    const reloadCategories = async () => {
      const codigoEmpresa = userProfile?.codigo_empresa || null;
      if (!authReady || !codigoEmpresa) return;
      try {
        const cats = await listCategories({ codigoEmpresa });
        if (!mountedRef.current) return;
        setCategories(cats);
        try { localStorage.setItem(`produtos:cats:${codigoEmpresa}`, JSON.stringify(cats)); } catch {}
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Categorias] load on mount:error', err);
      }
    };

    const handleAddCategory = async (name) => {
      // Otimista: adiciona de imediato na lista para aparecer no Select
      setCategories(prev => {
        if (prev.includes(name)) return prev;
        const next = [...prev, name];
        next.sort((a,b) => a.localeCompare(b, 'pt-BR'));
        return next;
      });
      try {
        await createCategory(name, { codigoEmpresa: userProfile?.codigo_empresa });
        // Sincroniza com backend (ordem/casos)
        await reloadCategories();
      } catch (err) {
        // rollback caso falhe
        setCategories(prev => prev.filter(c => c !== name));
        // eslint-disable-next-line no-console
        console.error('[Categorias] add:error', err);
        const m = mapDbErrorToMessage(err, { action: 'save' });
        toast({ title: m.title, description: m.description, variant: 'destructive' });
      }
    };

    const handleRemoveCategory = async (name) => {
      // Não permitir apagar se houver produtos ATIVOS vinculados
      const hasActiveProducts = products.some(p => (p.category === name) && (p.status !== 'inactive'));
      if (hasActiveProducts) {
        // lançar erro para o chamador (modal) tratar e exibir toast consistente
        throw new Error('Categoria possui produtos ativos vinculados');
      }
      // Otimista: remove local
      const prevList = categories;
      setCategories(prev => prev.filter(c => c !== name));
      try {
        await removeCategory(name, { codigoEmpresa: userProfile?.codigo_empresa });
        await reloadCategories();
      } catch (err) {
        // rollback
        setCategories(prevList);
        // eslint-disable-next-line no-console
        console.error('[Categorias] remove:error', err);
        const m = mapDbErrorToMessage(err, { action: 'save' });
        toast({ title: m.title, description: m.description, variant: 'destructive' });
      }
    };

    const handleSaveProduct = async (payload) => {
      try {
        // eslint-disable-next-line no-console
        console.log('[Produtos] handleSaveProduct', payload);
        if (!payload || typeof payload !== 'object') {
          console.warn('[Produtos] handleSaveProduct chamado sem payload válido. Ignorando.');
          return;
        }
        const codigoEmpresa = userProfile?.codigo_empresa || null;
        // Geração automática de código se vazio: usa backend para encontrar o menor código livre
        if (!payload.code && codigoEmpresa) {
          try {
            const nextCode = await getNextProductCode({ codigoEmpresa });
            payload.code = nextCode;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[Produtos] Falha ao obter próximo código automático', err);
          }
        }
        // Aplica um timeout curto só na gravação; refetch roda em background
        const withLocalTimeout = async (p) => {
          const timeoutMs = 12000;
          const t = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout update/create (12s)')), timeoutMs));
          return Promise.race([p, t]);
        };

        if (payload.id) {
          const updated = await withLocalTimeout(updateProduct(payload.id, payload, { codigoEmpresa }));
          // eslint-disable-next-line no-console
          console.log('[Produtos] Produto atualizado - active:', updated.active, 'status:', updated.status);
          setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
          // Refetch imediato para garantir sincronização
          await refetchProducts();
          console.log('[Produtos] Refetch concluído após update');
        } else {
          // Produto criado manualmente: marcar como "novo" usando dataImportacao
          if (!payload.dataImportacao) {
            payload.dataImportacao = new Date();
          }
          const created = await withLocalTimeout(createProduct(payload, { codigoEmpresa }));
          // eslint-disable-next-line no-console
          console.log('[Produtos] Produto criado', created);
          setProducts(prev => [created, ...prev]);
          setTimeout(() => { refetchProducts().catch(err => console.error('[Produtos] refetch pós-create falhou', err)); }, 0);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Produtos] Erro no handleSaveProduct', err);
        const m = mapDbErrorToMessage(err, { action: 'save' });
        toast({ title: m.title, description: m.description, variant: 'destructive' });
        throw err; // rethrow para o modal não fechar em caso de erro
      }
    };

    const handleAskDelete = (product) => {
      setProductToDelete(product);
      setConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
      if (!productToDelete?.id) return;
      try {
        setDeleting(true);
        await deleteProduct(productToDelete.id);
        // Otimista: remove local
        setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
        // Refetch para garantir consistência com RLS, triggers, etc.
        await refetchProducts();
        const m = mapDbErrorToMessage(null, { action: 'delete' });
        toast({
          variant: 'success',
          title: m.title,
          description: `Produto "${productToDelete.name}" foi inativado com sucesso.`,
        });
      } catch (err) {
        const m = mapDbErrorToMessage(err, { action: 'delete' });
        toast({ variant: 'destructive', ...m });
      } finally {
        setDeleting(false);
        setConfirmOpen(false);
        setProductToDelete(null);
      }
    };

    // Código sugerido para novo produto vem do backend (getNextProductCode), armazenado em estado local

    return (
      <>
        <motion.div variants={pageVariants} initial="hidden" animate="visible" className="flex flex-col">
	        <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
	            <div className="flex items-center justify-between gap-3">
	                <div>
	                    <h1 className="text-3xl font-black text-text-primary tracking-tighter">Controle de Produtos</h1>
	                    <p className="text-text-secondary hidden md:block">Controle total sobre seu inventário e estoque.</p>
	                </div>
	                <Button
	                  type="button"
	                  variant="outline"
	                  size="icon"
	                  className="h-9 w-9 rounded-full hidden md:flex items-center justify-center"
	                  onClick={() => setShowConfig(true)}
	                  aria-label="Configurações da aba"
	                  title="Configurações da aba"
	                >
	                  <Settings className="h-4 w-4" />
	                </Button>
	            </div>

                {/* Ações Desktop */}
                <div className="hidden md:flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="icon" onClick={() => setShowStats(s => !s)} title={showStats ? 'Ocultar resumo' : 'Mostrar resumo'} aria-label={showStats ? 'Ocultar resumo' : 'Mostrar resumo'}>
                      {showStats ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </Button>
                    <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Exportar</Button>
                    <Button variant="secondary" onClick={() => setIsXmlImportOpen(true)}><FileText className="mr-2 h-4 w-4" /> Importar XML</Button>
                    <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button>
                </div>

                {/* Ações Mobile */}
                <div className="mt-2 flex md:hidden items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-9 px-3 rounded-xl flex items-center gap-1 text-xs"
                    onClick={handleExport}
                    title="Exportar CSV"
                    aria-label="Exportar CSV"
                  >
                    <Download className="h-4 w-4" />
                    <span>CSV</span>
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 px-3 rounded-xl flex items-center gap-1 text-xs"
                    onClick={() => setIsXmlImportOpen(true)}
                    title="Importar XML"
                    aria-label="Importar XML"
                  >
                    <FileText className="h-4 w-4" />
                    <span>XML</span>
                  </Button>
                  <Button
                    className="h-9 px-3 rounded-xl flex items-center gap-1 text-xs"
                    onClick={handleAddNew}
                    title="Novo Produto"
                    aria-label="Novo Produto"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Prod</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 px-3 rounded-xl flex items-center gap-1 text-xs"
                    onClick={() => setIsCategoryModalOpen(true)}
                    title="Gerenciar categorias"
                    aria-label="Gerenciar categorias"
                  >
                    <Tag className="h-4 w-4" />
                    <span>Cat.</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl flex items-center justify-center ml-auto"
                    onClick={() => setShowConfig(true)}
                    title="Configurações da aba"
                    aria-label="Configurações da aba"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl flex items-center justify-center ml-auto"
                    onClick={() => setShowStats(s => !s)}
                    title={showStats ? 'Ocultar resumo' : 'Mostrar resumo'}
                    aria-label={showStats ? 'Ocultar resumo' : 'Mostrar resumo'}
                  >
                    {showStats ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}
                  </Button>
                </div>
            </motion.div>

            {showStats && (
              <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6">
                  <StatCard icon={Trophy} title={<><span className="hidden md:inline">Mais Vendido (Dia)</span><span className="md:hidden">+ vendidos</span></>} value={stats.mostSold} subtitle="Produto com mais saídas hoje" color="text-brand" onClick={handleOpenSalesModal} />
                  <StatCard icon={AlertTriangle} title={<><span className="hidden md:inline">Estoque Baixo</span><span className="md:hidden">Est. baixo</span></>} value={stats.lowStock} subtitle="Produtos precisando de reposição" color="text-warning" onClick={() => handleStatCardClick('low_stock')} isActive={activeFilter === 'low_stock'} />
                  <StatCard icon={CalendarX} title={<><span className="hidden md:inline">Vendidos</span><span className="md:hidden">Vencidos</span></>} value={stats.expired} subtitle="Produtos fora da data de validade" color="text-danger" onClick={() => handleStatCardClick('expired')} isActive={activeFilter === 'expired'} />
              </div>
            )}

            {/* Dialog deslocado para o escopo de ProdutosPage */}
            <Dialog open={isSalesModalOpen} onOpenChange={setIsSalesModalOpen}>
              <DialogContent className="max-w-2xl" onKeyDown={(e)=>e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Vendas por Período</DialogTitle>
                  <DialogDescription>Selecione o intervalo de datas e visualize os produtos vendidos.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label className="mb-1 block">Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarX className="mr-2 h-4 w-4" />
                          {salesFrom ? format(salesFrom, 'dd/MM/yyyy') : 'Início'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[300px]">
                        <div className="w-[300px] min-h-[332px]">
                          <Calendar mode="single" selected={salesFrom} onSelect={(d)=> d && setSalesFrom(d)} initialFocus fixedWeeks />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="mb-1 block">Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarX className="mr-2 h-4 w-4" />
                          {salesTo ? format(salesTo, 'dd/MM/yyyy') : 'Fim'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[300px]">
                        <div className="w-[300px] min-h-[332px]">
                          <Calendar mode="single" selected={salesTo} onSelect={(d)=> d && setSalesTo(d)} initialFocus fixedWeeks />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={loadSales} disabled={salesLoading} className="w-full">{salesLoading ? 'Carregando...' : 'Aplicar'}</Button>
                    <Button type="button" variant="secondary" onClick={()=>{
                      try {
                        const rows = salesItems || [];
                        const sep = ';';
                        const make = () => {
                          const lines = ['Produto;Quantidade'];
                          for (const r of rows) lines.push(`${(r.name||'').replace(/;/g, ',')}${sep}${Number(r.total||0)}`);
                          return lines.join('\n');
                        };
                        const blob = new Blob(['\uFEFF' + make()], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'vendas-periodo.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                        toast({ title: 'Exportação concluída', description: `${rows.length} linha(s)`, variant: 'success' });
                      } catch (e) { toast({ title: 'Falha ao exportar', description: e?.message || 'Tente novamente', variant: 'destructive' }); }
                    }}>Exportar CSV</Button>
                  </div>
                </div>
                <div className="mt-3 border rounded-md max-h-[50vh] overflow-auto thin-scroll">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-2">
                        <th className="text-left p-2">Produto</th>
                        <th className="text-right p-2">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salesItems || []).length === 0 && !salesLoading && (
                        <tr><td colSpan={2} className="p-3 text-text-muted">Nenhum item no período.</td></tr>
                      )}
                      {(salesItems || []).map(r => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2 text-right font-mono">{Number(r.total||0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">Fechar</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showConfig} onOpenChange={setShowConfig}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configurações da aba</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-text-muted">Modo de listagem</label>
                    <Select value={listMode} onValueChange={setListMode}>
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="Paginado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paged">Paginado (100 por página)</SelectItem>
                        <SelectItem value="all">Todos (sem paginação)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="produtos-show-stats"
                        checked={showStats}
                        onCheckedChange={setShowStats}
                      />
                      <label
                        htmlFor="produtos-show-stats"
                        className="text-xs font-medium text-text-primary"
                      >
                        Mostrar cards de resumo no topo
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">Fechar</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border flex flex-col">
                <div className="p-3 pb-4 sm:p-4 border-b border-border space-y-3 flex-shrink-0">
                    {/* Busca + botão filtro (mobile) */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                          <Input
                            placeholder="Buscar por nome ou código..."
                            className="pl-9 text-sm"
                            value={searchTerm}
                            onChange={(e)=>setSearchTerm(e.target.value)}
                          />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full flex md:hidden items-center justify-center"
                        onClick={() => setIsMobileFilterOpen(true)}
                        aria-label="Abrir filtros"
                        title="Filtros"
                      >
                        <Filter className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Filtros completos - apenas desktop/tablet */}
                    <div className="hidden md:flex w-full items-center gap-3">
                      <div className="flex-1 min-w-[120px]">
                        <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}>
                          <SelectTrigger className="w-full text-xs sm:text-sm bg-surface-2 border border-border rounded-full px-3">
                            <SelectValue/>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tipos</SelectItem>
                            <SelectItem value="Venda">Venda</SelectItem>
                            <SelectItem value="Uso Interno">Uso Interno</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1 min-w-[140px]">
                        <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}>
                          <SelectTrigger className="w-full text-xs sm:text-sm bg-surface-2 border border-border rounded-full px-3">
                            <SelectValue/>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Categorias</SelectItem>
                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1 max-w-[180px]">
                        <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}>
                          <SelectTrigger className="w-full text-xs sm:text-sm bg-surface-2 border border-border rounded-full px-3">
                            <SelectValue/>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Status</SelectItem>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="low_stock">Estoque Baixo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1 flex justify-end gap-2 min-w-[160px]">
                        <Button 
                          variant="outline"
                          onClick={() => handleFilterChange('newOnly', !filters.newOnly)} 
                          className={cn(
                            "text-xs sm:text-sm rounded-full px-3 border border-border bg-surface-2 hover:bg-surface flex items-center gap-1 whitespace-nowrap",
                            filters.newOnly && "bg-amber-500 text-black border-amber-500 hover:bg-amber-400"
                          )}
                          size="sm"
                        >
                          <span className="mr-1">✨</span>
                          <span>Novos</span>
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => setIsCategoryModalOpen(true)}
                          className="text-xs sm:text-sm rounded-full px-3 border border-border bg-surface-2 hover:bg-surface flex items-center gap-1 whitespace-nowrap"
                          size="sm"
                        >
                          <Tag className="h-3 w-3 sm:h-4 sm:w-4"/>
                          <span>Categorias</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full flex items-center justify-center"
                          onClick={() => setShowConfig((v) => !v)}
                          aria-label="Configurações da aba"
                          title="Configurações da aba"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                </div>

                {selectedProductIds.length > 0 && (
                  <>
                    {/* Barra MOBILE: minimalista */}
                    <div className="px-3 sm:px-4 py-2.5 border-b border-border flex md:hidden items-center gap-2 text-xs">
                      <span className="font-medium mr-2">
                        {selectedProductIds.length} sel.
                      </span>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface-2"
                        onClick={() => {
                          const allVisibleSelected =
                            sortedProducts.length > 0 &&
                            sortedProducts.every(p => selectedProductIds.includes(p.id));
                          handleToggleSelectAllVisible(!allVisibleSelected);
                        }}
                      >
                        <Checkbox
                          checked={sortedProducts.length > 0 && sortedProducts.every(p => selectedProductIds.includes(p.id))}
                          className="h-4 w-4"
                        />
                        <span>Todos</span>
                      </button>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleBulkStatusChange('active')}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-danger border-danger/60 hover:bg-danger/10"
                          onClick={() => handleBulkStatusChange('inactive')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {hasNewSelected && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-amber-500/70 text-amber-700 hover:bg-amber-500/10"
                            onClick={handleBulkClearNewFlag}
                          >
                            <Tag className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Barra DESKTOP: ações em massa com ícones */}
                    <div className="hidden md:flex px-4 py-2 border-b border-border items-center gap-3 text-xs">
                      <span className="font-medium text-text-secondary whitespace-nowrap">
                        {selectedProductIds.length === 0
                          ? 'Nenhum item selecionado'
                          : `${selectedProductIds.length} produto${selectedProductIds.length > 1 ? 's' : ''} selecionado${selectedProductIds.length > 1 ? 's' : ''}`}
                      </span>
                      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="xs"
                          className="h-7 px-3 rounded-full border border-border bg-surface-2 hover:bg-surface flex items-center gap-1"
                          onClick={handleSelectAllFiltered}
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span>Marcar filtrados</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          className="h-7 px-3 rounded-full border border-border bg-surface-2 hover:bg-surface flex items-center gap-1"
                          onClick={handleClearSelection}
                        >
                          <Filter className="h-3 w-3" />
                          <span>Limpar seleção</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-7 px-3 rounded-full border-emerald-500/70 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-1"
                          onClick={() => handleBulkStatusChange('active')}
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span>Ativar itens</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-7 px-3 rounded-full text-danger border-danger/60 hover:bg-danger/10 flex items-center gap-1"
                          onClick={() => handleBulkStatusChange('inactive')}
                        >
                          <EyeOff className="h-3 w-3" />
                          <span>Desativar itens</span>
                        </Button>
                        {hasNewSelected && (
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-7 px-3 rounded-full border-amber-500/70 text-amber-500 hover:bg-amber-500/10 flex items-center gap-1"
                            onClick={handleBulkClearNewFlag}
                          >
                            <Tag className="h-3 w-3" />
                            <span>Limpar tag "Novo"</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div>
                    {sortedProducts.length === 0 ? (
                      <div className="p-10 text-center text-text-secondary">
                        <p className="text-lg mb-3">Nenhum produto cadastrado.</p>
                        <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" />Cadastrar primeiro produto</Button>
                      </div>
                    ) : (
                      <>
                        {/* Layout Mobile - Cards */}
                        <div className="md:hidden p-3 space-y-3">
                          {sortedProducts.map(p => {
                            const isSelected = selectedProductIds.includes(p.id);
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "rounded-lg border bg-surface p-4 space-y-3 cursor-pointer",
                                  isSelected ? "border-brand/70 bg-brand/5" : "border-border"
                                )}
                                onClick={() => handleEdit(p)}
                              >
                                {/* Header: seleção + Nome + Status */}
                                <div className="flex items-start justify-between gap-3">
                                  <button
                                    type="button"
                                    className="pt-1 pr-2 -ml-1 flex items-center justify-center w-9 h-9"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSelectProduct(p.id);
                                    }}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      className="h-5 w-5 border-2"
                                    />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-base text-text-primary truncate" title={p.name}>{p.name}</h3>
                                    {p.dataImportacao && (() => {
                                      const daysSince = Math.floor((new Date() - p.dataImportacao) / (1000 * 60 * 60 * 24));
                                      return daysSince <= 7 ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand/20 text-brand text-xs font-medium flex-shrink-0">
                                          <span>✨</span>
                                          <span>Novo</span>
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                  <p className="text-xs text-text-muted mt-0.5">{p.category || 'Sem categoria'}</p>
                                </div>
                                <span className={cn(
                                  "inline-flex px-2 py-0.5 rounded-full text-xs border flex-shrink-0",
                                  p.status === 'active' && 'bg-emerald-50/5 border-emerald-500/30 text-emerald-400',
                                  p.status === 'low_stock' && 'bg-amber-50/5 border-amber-500/30 text-amber-400',
                                  p.status === 'inactive' && 'bg-surface-2 border-border text-text-muted'
                                )}>
                                  {p.status === 'active' ? 'Ativo' : p.status === 'low_stock' ? 'Estoque Baixo' : 'Inativo'}
                                </span>
                                </div>

                              {/* Linha compacta: Código • Preço • Estoque */}
                              <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                                {p.code && (
                                  <span className="flex items-center gap-1">
                                    <span>Cód.</span>
                                    <span className="font-mono text-text-primary text-xs">{p.code}</span>
                                  </span>
                                )}
                                <span className="mx-1 text-text-muted">•</span>
                                <span className="flex items-center gap-1">
                                  <span>R$</span>
                                  <span className="font-semibold text-text-primary">
                                    {p.price.toFixed(2)}
                                  </span>
                                </span>
                                <span className="mx-1 text-text-muted">•</span>
                                <span className="flex items-center gap-1">
                                  <span>Est.</span>
                                  <span className="font-medium text-text-primary">{p.stock}</span>
                                </span>
                                {p.validade && (
                                  <span className="mx-1 text-text-muted">•</span>
                                )}
                                {p.validade && (
                                  <span className="flex items-center gap-1">
                                    <span>Val.</span>
                                    <span className="text-text-primary">
                                      {(() => {
                                        const d = p.validade instanceof Date ? p.validade : parseISO(String(p.validade));
                                        return isNaN(d) ? '-' : format(d, 'dd/MM/yy');
                                      })()}
                                    </span>
                                  </span>
                                )}

                                {/* Botões de Ação (mobile) */}
                                <div className="ml-auto flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(p);
                                    }}
                                    className="h-7 w-7"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAskDelete(p);
                                    }}
                                    className="h-7 w-7 text-danger hover:text-danger"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Layout Desktop - Tabela */}
                        <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm bg-surface table-fixed">
                            <thead className="bg-surface-2 text-text-secondary">
                                <tr className="border-b border-border">
                                    <th className="p-3 w-10 text-center">
                                      <Checkbox
                                        checked={sortedProducts.length > 0 && sortedProducts.every(p => selectedProductIds.includes(p.id))}
                                        onCheckedChange={(checked) => handleToggleSelectAllVisible(!!checked)}
                                      />
                                    </th>
                                    <th className="p-3 text-left font-semibold select-none cursor-pointer whitespace-nowrap w-[110px]" onClick={() => toggleSort('code')}>
                                      Código {sort.by === 'code' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                                    </th>
                                    <th className="p-3 text-left font-semibold select-none cursor-pointer whitespace-nowrap w-[40%]" onClick={() => toggleSort('name')}>
                                      Produto {sort.by === 'name' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                                    </th>
                                    <th className="p-3 text-left font-semibold whitespace-nowrap w-[18%]">Categoria</th>
                                    <th className="p-3 text-right font-semibold whitespace-nowrap w-[120px]">Preço</th>
                                    <th className="p-3 text-right font-semibold whitespace-nowrap w-[110px]">Estoque</th>
                                    <th className="p-3 text-center font-semibold select-none cursor-pointer whitespace-nowrap w-[120px]" onClick={() => toggleSort('validade')}>
                                      Validade {sort.by === 'validade' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                                    </th>
                                    <th className="p-3 text-center font-semibold whitespace-nowrap w-[140px]">Status</th>
                                    <th className="p-3 text-right font-semibold whitespace-nowrap w-[90px]">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-text-primary divide-y divide-border">
                                {sortedProducts.map(p => (
                                    <tr key={p.id} className="hover:bg-surface-2 transition-colors group cursor-pointer align-middle">
                                        <td className="p-3 text-center align-middle">
                                          <Checkbox
                                            checked={selectedProductIds.includes(p.id)}
                                            onCheckedChange={() => handleToggleSelectProduct(p.id)}
                                          />
                                        </td>
                                        <td className="p-3 font-mono text-sm text-text-secondary align-middle whitespace-nowrap" onClick={() => handleEdit(p)}>{p.code || '-'}</td>
                                        <td className="p-3 font-semibold align-middle text-text-primary whitespace-nowrap overflow-hidden text-ellipsis" onClick={() => handleEdit(p)} title={p.name}>
                                          <div className="flex items-center gap-2">
                                            <span className="truncate">{p.name}</span>
                                            {p.dataImportacao && (() => {
                                              const daysSince = Math.floor((new Date() - p.dataImportacao) / (1000 * 60 * 60 * 24));
                                              return daysSince <= 7 ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand/20 text-brand text-xs font-medium flex-shrink-0">
                                                  <span>✨</span>
                                                  <span>Novo</span>
                                                </span>
                                              ) : null;
                                            })()}
                                          </div>
                                        </td>
                                        <td className="p-3 text-text-secondary align-middle whitespace-nowrap" onClick={() => handleEdit(p)}>{p.category}</td>
                                        <td className="p-3 text-right font-mono tabular-nums align-middle whitespace-nowrap" onClick={() => handleEdit(p)}>R$ {p.price.toFixed(2)}</td>
                                        <td className="p-3 text-right font-mono tabular-nums align-middle whitespace-nowrap" onClick={() => handleEdit(p)}>{p.stock}</td>
                                        <td className="p-3 text-center font-mono tabular-nums whitespace-nowrap" onClick={() => handleEdit(p)}>{(() => {
                  if (!p.validade) return '-';
                  const d = p.validade instanceof Date ? p.validade : parseISO(String(p.validade));
                  return isNaN(d) ? '-' : format(d, 'dd/MM/yy');
                })()}</td>
                                        <td className="p-3 text-center whitespace-nowrap" onClick={() => handleEdit(p)}>
                                            <span className={cn(
                                                "px-2 py-1 text-xs font-bold rounded-full",
                                                p.status === 'active' && 'bg-success/10 text-success',
                                                p.status === 'low_stock' && 'bg-warning/10 text-warning',
                                                p.status === 'inactive' && 'bg-danger/10 text-danger'
                                            )}>{p.status === 'active' ? 'Ativo' : p.status === 'low_stock' ? 'Estoque Baixo' : 'Inativo' }</span>
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-danger" onClick={(e) => { e.stopPropagation(); handleAskDelete(p); }}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                </div>

                {usePagination && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2 text-xs sm:text-sm text-text-muted px-3 sm:px-4 pb-3">
                    <span>
                      Página {page} de {totalPages} ({totalCount} produto(s))
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={page >= totalPages}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
            </motion.div>
        </motion.div>

        <ProductFormModal 
            open={isFormOpen} 
            onOpenChange={setIsFormOpen}
            product={selectedProduct}
            categories={categories}
            onSave={handleSaveProduct}
            onCreateCategory={handleAddCategory}
            suggestedCode={selectedProduct ? undefined : suggestedCode}
            onRefreshProducts={refetchProducts}
            products={products}
        />
        {/* Confirm Dialog for Delete */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Excluir produto</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o produto
                {productToDelete ? ` "${productToDelete.name}"` : ''}? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={deleting}>Cancelar</Button>
              </DialogClose>
              <Button type="button" variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Importação XML */}
        <XMLImportModal
            open={isXmlImportOpen}
            onOpenChange={setIsXmlImportOpen}
            products={products}
            codigoEmpresa={userProfile?.codigo_empresa}
            onSuccess={() => {
              refetchProducts();
              setIsXmlImportOpen(false);
            }}
        />

        {/* Filtros Mobile */}
        <Dialog open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
          <DialogContent className="w-[90vw] sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-base">Filtros de Produtos</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Venda">Venda</SelectItem>
                    <SelectItem value="Uso Interno">Uso Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="low_stock">Estoque Baixo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="mobileNewOnly"
                  checked={!!filters.newOnly}
                  onCheckedChange={(v) => handleFilterChange('newOnly', !!v)}
                />
                <Label htmlFor="mobileNewOnly" className="text-xs flex items-center gap-1">
                  <span>Somente Novos</span>
                </Label>
              </div>
            </div>
            <DialogFooter className="flex justify-between mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setFilters({ type: 'all', category: 'all', status: 'active', newOnly: false });
                  setIsMobileFilterOpen(false);
                }}
              >
                Limpar
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs"
                onClick={() => setIsMobileFilterOpen(false)}
              >
                Aplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CategoryManagerModal 
            open={isCategoryModalOpen}
            onOpenChange={setIsCategoryModalOpen}
            categories={categories}
            onAddCategory={handleAddCategory}
            onRemoveCategory={handleRemoveCategory}
        />
      </>
    );
}

export default ProdutosPage;
