import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Check, X, ChevronUp, ChevronDown } from 'lucide-react';
import { IsisAvatar } from '@/components/isis/IsisAvatar';
import { supabase } from '@/lib/supabase';
import { createPortal } from 'react-dom';

/**
 * Input para adicionar participantes - Estilo Ísis
 */
export const IsisParticipantesInput = ({ 
  participantesAtuais = [],
  onAdicionar,
  onRemover,
  onFinalizar, 
  disabled = false,
  onAdicionarLote,
  selfName: selfNameProp,
  onFixedRolesDetected
}) => {
  const [nome, setNome] = useState('');
  const [focused, setFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [invalid, setInvalid] = useState([]);
  const [selectedMap, setSelectedMap] = useState({});
  const [hasProcessed, setHasProcessed] = useState(false);
  const [selfDetected, setSelfDetected] = useState(false);
  const [selfMatchedKey, setSelfMatchedKey] = useState(null);
  const [expandedList, setExpandedList] = useState(false);
  const listRef = useRef(null);
  const toolbarRef = useRef(null);

  // Detecta se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (showImport) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setHasProcessed(false);
      setSelfDetected(false);
      setSelfMatchedKey(null);
      return () => { document.body.style.overflow = prev; };
    }
  }, [showImport]);

  useEffect(() => {
    if (showImport && selfName && (!suggested || suggested.length === 0)) {
      const key = canonicalKey(selfName);
      setSuggested([selfName]);
      setSelectedMap({ [key]: true });
      setSelfMatchedKey(key);
      setSelfDetected(true);
      setHasProcessed(true);
    }
  }, [showImport]);

  const removeDiacritics = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const canonicalKey = (str) => removeDiacritics(String(str || '').trim().toLowerCase()).replace(/\s+/g, ' ');
  const presentKeys = new Set((participantesAtuais || []).map(p => canonicalKey(p.nome)));
  const selfName = selfNameProp
    ? String(selfNameProp).trim()
    : (participantesAtuais && participantesAtuais[0] && participantesAtuais[0].nome)
        ? String(participantesAtuais[0].nome).trim()
        : null;
  const selfKey = selfName ? canonicalKey(selfName) : null;

  const tokenize = (s) => removeDiacritics(String(s || '').toLowerCase())
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);

  const isSelfMatch = (name) => {
    if (!selfName) return false;
    const cand = String(name || '').trim();
    if (!cand) return false;
    // Igualdade canônica direta
    if (canonicalKey(cand) === selfKey) return true;
    // Sobreposição por token (ex.: "Íthalo" dentro de nome completo)
    const selfTokens = tokenize(selfName);
    const candTokens = tokenize(cand);
    if (selfTokens.length === 0 || candTokens.length === 0) return false;
    return candTokens.some(t => selfTokens.includes(t));
  };

  // Extrai chaves canônicas dos nomes que estão sob o cabeçalho "Lista de espera", "Lista de reserva" ou "Convidados"
  const extractWaitlistKeys = (text) => {
    const keys = new Set();
    if (!text) return keys;
    const lines = String(text).split(/\r?\n/);
    let inWaitlist = false;
    for (let raw of lines) {
      const normalized = removeDiacritics(String(raw || '')).toLowerCase().trim();
      if (!inWaitlist) {
        if (/^\s*[*\-•°]?\s*(lista\s+de\s+(espera|reserva)|convidad\w*)\b[\s:]*$/i.test(normalized)) {
          inWaitlist = true;
        }
        continue;
      }
      // Encerrar seção ao encontrar um novo cabeçalho comum (exceto 'convidados', que também é seção excluída)
      if (/^\s*\*\s*\w+|^\s*(convocad|jogad|levanta|goleir)\w*/i.test(removeDiacritics(raw))) {
        inWaitlist = false;
        continue;
      }
      const candidate = String(raw)
        .replace(/^\s*[°•*\-]+\s*/g, '')
        .replace(/^\s*\d+\)?\s*/g, '')
        .replace(/^[\W_]+/, '')
        .trim();
      const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(candidate);
      const ok = candidate && hasLetters && !/[0-9@]/.test(candidate) && candidate.length >= 2 && candidate.length <= 60;
      if (ok) keys.add(canonicalKey(candidate));
    }
    return keys;
  };

  // Extrai seções de papéis fixos como LEVANTADORES e GOLEIROS do texto importado
  const extractFixedRoles = (text) => {
    const lines = String(text || '').split(/\r?\n/);
    const roles = { levantadores: [], goleiros: [] };
    let current = null; // 'levantadores' | 'goleiros' | null
    for (let raw of lines) {
      const norm = removeDiacritics(String(raw || '')).toLowerCase().trim();
      // Detecta início de seção
      if (/^\s*[*\-•°]?\s*levanta(dor|dores|dor(es)?)\b/i.test(norm)) { current = 'levantadores'; continue; }
      if (/^\s*[*\-•°]?\s*goleir(o|os|a|as)\b/i.test(norm)) { current = 'goleiros'; continue; }
      // Encerramento por novo cabeçalho comum (ex.: *JOGADORES*, Convocados, Lista de espera, Convidados, nova seção de papel)
      if (current) {
        if (/(^|\s)jogador(e|es)\b/.test(norm)) { current = null; continue; }
        if (/^\s*[*\-•°]?\s*(convocad|lista\s+de\s+(espera|reserva)|convidad)\b/i.test(norm)) { current = null; continue; }
        if (/^\s*[*_]{1,3}\s*[a-zà-ÿ]+/i.test(norm)) { current = null; continue; } // linhas de cabeçalho enfatizadas
        if (/^\s*[*\-•°]?\s*(levanta|goleir)\b/i.test(norm)) { current = null; continue; } // troca de papel
      }
      if (!current) continue;
      // Extrai nome da linha
      const candidate = String(raw)
        .replace(/^\s*[°•*\-]+\s*/g, '')
        .replace(/^\s*\d+\)?\s*/g, '')
        .replace(/^[\W_]+/, '')
        .trim();
      const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(candidate);
      const ok = candidate && hasLetters && !/[0-9@]/.test(candidate) && candidate.length >= 2 && candidate.length <= 60;
      if (!ok) continue;
      // Normaliza para Title Case simples mantendo espaços simples
      const title = candidate
        .toLowerCase()
        .split(/\s+/)
        .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
      const key = canonicalKey(title);
      if (current === 'levantadores') {
        if (!roles.levantadores.some(n => canonicalKey(n) === key)) roles.levantadores.push(title);
      } else if (current === 'goleiros') {
        if (!roles.goleiros.some(n => canonicalKey(n) === key)) roles.goleiros.push(title);
      }
    }
    return roles;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!nome.trim() || disabled) return;
    
    onAdicionar(nome.trim());
    setNome(''); // Limpa input após adicionar
    
    // Foca no input novamente após adicionar
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isMobile) {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter = Finalizar
        onFinalizar();
      } else {
        // Enter = Adicionar
        handleSubmit(e);
      }
    }
  };

  const processWithAI = async () => {
    if (!importText.trim()) return;
    setIsProcessing(true);
    setSuggested([]);
    setInvalid([]);
    setSelectedMap({});
    try {
      const { data, error } = await supabase.functions.invoke('parse-participants', {
        body: { text: importText, locale: 'pt-BR' },
      });
      if (error) throw error;
      // Log simples para confirmar a fonte (openai vs fallback)
      if (data && typeof data.source === 'string') {
        console.log('[Isis Import] source=', data.source);
      }
      const waitlistKeys = extractWaitlistKeys(importText);
      const fixedRoles = extractFixedRoles(importText);
      const extractedRaw = Array.isArray(data?.extracted) ? data.extracted : [];
      const extracted = extractedRaw.filter(n => !waitlistKeys.has(canonicalKey(n)));
      // detecta se o próprio usuário apareceu no texto processado (antes dos filtros)
      const detectedSelf = extracted.some(n => isSelfMatch(n));
      const invalidItems = Array.isArray(data?.invalid) ? data.invalid : [];
      const uniques = [];
      const seen = new Set();
      for (const n of extracted) {
        const key = canonicalKey(n);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniques.push(n);
      }
      // move o próprio usuário (se detectado) para o topo
      let ordered = uniques.slice(0, 50);
      let matchIdx = ordered.findIndex(n => isSelfMatch(n));
      if (matchIdx >= 0) {
        const matched = ordered[matchIdx];
        setSelfMatchedKey(canonicalKey(matched));
        ordered = [matched, ...ordered.filter((_, i) => i !== matchIdx)];
      } else if (selfName) {
        const key = canonicalKey(selfName);
        setSelfMatchedKey(key);
        setSelfDetected(true);
        ordered = [selfName, ...ordered];
      } else {
        setSelfMatchedKey(null);
      }
      setSuggested(ordered);
      setInvalid(invalidItems);
      const initialSel = {};
      if (selfName) initialSel[canonicalKey(selfName)] = true;
      uniques.slice(0, 50).forEach(n => { initialSel[canonicalKey(n)] = true; });
      setSelectedMap(initialSel);
      setHasProcessed(true);
      setSelfDetected(detectedSelf || !!selfName);
      try {
        if (typeof onFixedRolesDetected === 'function') onFixedRolesDetected(fixedRoles);
        else window.dispatchEvent(new CustomEvent('isis:fixed-roles', { detail: fixedRoles }));
      } catch {}
    } catch (err) {
      const waitlistKeys = extractWaitlistKeys(importText);
      const fixedRoles = extractFixedRoles(importText);
      const local = importText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      const detectedSelf = local.some(item => {
        const cleaned = item.replace(/^[\W_]+|[\W_]+$/g, '');
        return isSelfMatch(cleaned);
      });
      const uniques = [];
      const seen = new Set();
      for (const item of local) {
        const cleaned = item.replace(/^[\W_]+|[\W_]+$/g, '');
        const key = canonicalKey(cleaned);
        const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(cleaned);
        const ok = cleaned.length >= 2 && cleaned.length <= 60 && hasLetters && !/[0-9@]/.test(cleaned);
        if (!ok || !key) continue;
        if (waitlistKeys.has(key)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        const title = cleaned.toLowerCase().split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
        uniques.push(title);
      }
      let ordered = uniques.slice(0, 50);
      if (selfName) {
        const key = canonicalKey(selfName);
        setSelfMatchedKey(key);
        setSelfDetected(true);
        ordered = [selfName, ...ordered];
      }
      setSuggested(ordered);
      const initialSel = {};
      if (selfName) initialSel[canonicalKey(selfName)] = true;
      uniques.slice(0, 50).forEach(n => { initialSel[canonicalKey(n)] = true; });
      setSelectedMap(initialSel);
      setHasProcessed(true);
      setSelfDetected(detectedSelf || !!selfName);
      try {
        if (typeof onFixedRolesDetected === 'function') onFixedRolesDetected(fixedRoles);
        else window.dispatchEvent(new CustomEvent('isis:fixed-roles', { detail: fixedRoles }));
      } catch {}
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelect = (name) => {
    const key = canonicalKey(name);
    setSelectedMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllSuggested = () => {
    const next = { ...selectedMap };
    suggested.forEach(n => { next[canonicalKey(n)] = true; });
    setSelectedMap(next);
  };

  const clearAllSelection = () => {
    const next = { ...selectedMap };
    suggested.forEach(n => { next[canonicalKey(n)] = false; });
    setSelectedMap(next);
  };

  const addSelected = () => {
    const toAdd = suggested.filter(n => {
      const key = canonicalKey(n);
      // não adicionar o próprio usuário mesmo que marcado visualmente
      if (selfMatchedKey && key === selfMatchedKey) return false;
      return selectedMap[key];
    });
    if (toAdd.length === 0) return;
    if (typeof onAdicionarLote === 'function') {
      onAdicionarLote(toAdd);
    } else {
      toAdd.forEach(n => onAdicionar(n));
    }
    setShowImport(false);
    setImportText('');
    setSuggested([]);
    setInvalid([]);
    setSelectedMap({});
  };

  const clearImport = () => {
    setImportText('');
    setSuggested([]);
    setInvalid([]);
    setSelectedMap({});
    setHasProcessed(false);
    setSelfDetected(false);
    setSelfMatchedKey(null);
  };

  const exportarLista = async () => {
    try {
      const lines = (participantesAtuais || []).map((p, i) => `${i + 1}) ${p.nome}`);
      const text = lines.join('\n');
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 w-full"
    >
      <div ref={toolbarRef} className="flex items-center justify-end gap-2 scroll-mt-24 md:scroll-mt-28">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowImport(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${disabled ? 'bg-surface/30 text-text-muted cursor-not-allowed' : 'bg-surface/80 hover:bg-surface/60 border border-white/10 text-text-primary'}`}
        >
          Importar lista
        </button>
        <button
          type="button"
          onClick={() => {
            setExpandedList(v => {
              const next = !v;
              try { window.dispatchEvent(new CustomEvent('isis-participantes-expand', { detail: { expanded: next } })); } catch {}
              return next;
            });
            setTimeout(() => {
              try { toolbarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
            }, 50);
          }}
          className={`p-2 rounded-lg border transition-all ${expandedList ? 'bg-white/10 border-brand/40 text-brand shadow-sm' : 'hover:bg-white/10 border-white/10'}`}
          aria-label={expandedList ? 'Recolher lista' : 'Expandir lista'}
          aria-pressed={expandedList}
        >
          {expandedList ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
      {/* Lista de Participantes - Compacta no mobile */}
      {participantesAtuais.length > 0 && (
        <div ref={listRef} className={`flex flex-col gap-1.5 ${expandedList ? 'max-h-[360px] md:max-h-[400px]' : 'max-h-[140px]'} overflow-y-auto px-1 transition-all`}>
          {participantesAtuais.map((p, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                p.principal 
                  ? 'bg-brand/10 border border-brand/30' 
                  : 'bg-surface/50 border border-white/10'
              }`}
            >
              <span className="w-7 shrink-0">
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-extrabold ${p.principal ? 'bg-brand/20 text-brand' : 'bg-white/10 text-text-primary'}`}>
                  {index + 1}
                </span>
              </span>
              <span className="text-base shrink-0">
                {p.principal ? '👤' : '👥'}
              </span>
              <span className={`flex-1 font-medium truncate ${
                p.principal ? 'text-brand' : 'text-text-primary'
              }`}>
                {p.nome}
                {p.principal && <span className="ml-1.5 text-xs opacity-70">(você)</span>}
              </span>
              
              {/* Botão Remover - Apenas para participantes que não são o principal */}
              {!p.principal && onRemover && (
                <motion.button
                  type="button"
                  onClick={() => onRemover(index)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="shrink-0 p-1 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                  title="Remover participante"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Input de Adicionar - Mobile Otimizado */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className={`
          flex items-center gap-2 px-3 py-2.5 rounded-xl
          bg-surface/70 backdrop-blur-sm
          border-2 transition-all duration-300
          ${focused ? 'border-brand/50 shadow-lg shadow-brand/10' : 'border-white/10 shadow-md'}
        `}>
          <UserPlus className={`w-4 h-4 shrink-0 transition-colors ${
            focused ? 'text-brand' : 'text-text-muted'
          }`} />
          
          <input
            ref={inputRef}
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={isMobile ? "Nome" : "Nome do participante"}
            disabled={disabled}
            autoComplete="off"
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-base font-medium min-w-0"
          />

          {/* Botão Adicionar - Compacto */}
          <motion.button
            type="submit"
            whileHover={{ scale: nome.trim() ? 1.05 : 1 }}
            whileTap={{ scale: nome.trim() ? 0.95 : 1 }}
            disabled={!nome.trim() || disabled}
            className={`
              px-3 py-1.5 rounded-lg transition-all duration-300 text-sm font-semibold shrink-0
              ${
                nome.trim()
                  ? 'bg-brand text-bg shadow-md'
                  : 'bg-surface-light text-text-muted cursor-not-allowed opacity-50'
              }
            `}
          >
            Adicionar
          </motion.button>
        </div>

        {/* Botão Finalizar - Destaque */}
        <motion.button
          type="button"
          onClick={onFinalizar}
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          className={`
            w-full px-6 py-3.5 rounded-xl font-bold text-base
            transition-all duration-300
            ${
              disabled
                ? 'bg-surface/30 text-text-muted cursor-not-allowed'
                : 'bg-brand text-bg shadow-lg hover:shadow-xl hover:shadow-brand/30'
            }
          `}
        >
          <span className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            Confirmar Participantes ({participantesAtuais.length})
          </span>
        </motion.button>

        {/* Dica - Apenas Desktop */}
        {!isMobile && (
          <p className="text-xs text-text-muted text-center mt-1">
            💡 <kbd className="px-1.5 py-0.5 bg-surface rounded text-[10px]">Enter</kbd> adiciona • <kbd className="px-1.5 py-0.5 bg-surface rounded text-[10px]">Shift+Enter</kbd> confirma
          </p>
        )}
      </form>

      {showImport && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !isProcessing && setShowImport(false)} />
          <div className="min-h-screen flex items-start justify-center pt-24 md:pt-16 pb-8 px-3">
            <div className="relative w-[96vw] max-w-5xl bg-gradient-to-br from-surface via-background to-surface border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              <div className="sticky top-0 z-10 px-5 py-4 border-b border-white/10 bg-surface/70 backdrop-blur flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IsisAvatar size="sm" variant="header" />
                  <div>
                    <h3 className="text-base md:text-lg font-extrabold text-text-primary leading-tight">{suggested.length > 0 ? 'Sugestões encontradas' : 'Importar participantes'}</h3>
                    <p className="text-[11px] md:text-xs text-text-muted">{suggested.length > 0 ? `Selecione os nomes para adicionar (${suggested.length})` : 'Cole sua lista e processe com IA'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={isProcessing} onClick={() => setShowImport(false)} className="p-2 rounded-lg hover:bg-white/10">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 max-h-[70vh] overflow-y-auto p-4 md:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                  <div className="flex flex-col h-full">
                    <label className="text-xs text-text-muted mb-2">Sua lista</label>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      disabled={isProcessing}
                      placeholder={"Exemplo:\n1) João Silva\n2) Maria Clara\n3) Pedro Henrique\n\nDica: nomes sob os cabeçalhos 'Lista de espera', 'Lista de reserva' ou 'Convidados' serão ignorados.\n\nCole sua lista (um por linha ou separados por vírgula) e clique em “Processar com Ísis”"}
                      className="w-full min-h-[320px] max-h-[320px] resize-none overflow-y-auto bg-surface border border-white/10 rounded-xl p-3 outline-none text-sm focus:ring-2 focus:ring-brand/40"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={clearImport}
                        disabled={isProcessing && !importText.trim()}
                        className="px-4 py-2 rounded-xl font-semibold bg-surface border border-white/10 text-text-primary hover:bg-white/10 disabled:opacity-60"
                      >
                        Apagar
                      </button>
                      <button
                        type="button"
                        onClick={processWithAI}
                        disabled={isProcessing || !importText.trim()}
                        className={`px-5 py-2.5 rounded-xl font-semibold shadow-lg transition bg-gradient-to-r from-brand to-emerald-500 text-white hover:shadow-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {isProcessing ? 'Processando…' : 'Processar com Ísis'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>Sugeridos</span>
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-white/10">{suggested.length}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={selectAllSuggested} disabled={isProcessing} className="px-2 py-1 text-xs rounded-lg bg-surface hover:bg-white/10 disabled:opacity-50">Selecionar todos</button>
                        <button type="button" onClick={clearAllSelection} disabled={isProcessing} className="px-2 py-1 text-xs rounded-lg bg-surface hover:bg-white/10 disabled:opacity-50">Limpar</button>
                      </div>
                    </div>
                    <div className="min-h-[320px] max-h-[320px] overflow-y-auto border border-white/10 rounded-xl bg-surface">
                      {isProcessing ? (
                        <div className="p-3 animate-pulse">
                          <div className="h-4 w-28 bg-white/10 rounded mb-3" />
                          <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-2">
                                <div className="h-3 w-40 bg-white/10 rounded" />
                                <div className="h-4 w-4 bg-white/10 rounded" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <ul className="divide-y divide-white/5">
                          {suggested.map((n, idx) => {
                            const key = canonicalKey(n);
                            const isSelf = hasProcessed && selfDetected && selfMatchedKey && key === selfMatchedKey;
                            return (
                              <li key={key} className={`flex items-center justify-between px-3 py-2 ${isSelf ? 'bg-white/5' : ''}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-7 shrink-0">
                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-extrabold ${isSelf ? 'bg-emerald-600/25 text-emerald-400' : 'bg-white/10 text-text-primary'}`}>
                                      {idx + 1}
                                    </span>
                                  </span>
                                  <span className="text-sm truncate pr-1">{n}</span>
                                  {isSelf && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shrink-0">Você</span>
                                  )}
                                </div>
                                <input type="checkbox" className="w-4 h-4" checked={isSelf ? true : !!selectedMap[key]} onChange={() => !isSelf && toggleSelect(n)} disabled={isSelf} />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {hasProcessed && suggested.length === 0 && importText.trim() && !isProcessing && (
                      <div className="p-3 text-sm text-text-muted">Nenhum nome novo encontrado.</div>
                    )}
                    {invalid.length > 0 && (
                      <div className="mt-2 text-xs text-text-muted flex items-center gap-2">
                        <span>Ignorados</span>
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-white/10">{invalid.length}</span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={addSelected}
                        disabled={isProcessing || suggested.filter(n => selectedMap[canonicalKey(n)]).length === 0}
                        className={`px-5 py-2.5 rounded-xl font-semibold ${isProcessing || suggested.filter(n => selectedMap[canonicalKey(n)]).length === 0 ? 'bg-surface/30 text-text-muted cursor-not-allowed' : 'bg-emerald-600 text-white shadow-lg hover:shadow-emerald-600/30 transition'}`}
                      >
                        {(() => {
                          const count = suggested.reduce((acc, n) => {
                            const key = canonicalKey(n);
                            const isSelf = hasProcessed && selfDetected && selfMatchedKey && key === selfMatchedKey;
                            if (isSelf) return acc + 1;
                            return acc + (selectedMap[key] ? 1 : 0);
                          }, 0);
                          return `Adicionar selecionados (${count})`;
                        })()}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
};
