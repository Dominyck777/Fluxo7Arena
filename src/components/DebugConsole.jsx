import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Line = ({ label, value, error }) => (
  <div className="text-xs flex gap-2 py-0.5">
    <span className="min-w-[120px] text-text-secondary">{label}:</span>
    <span className={error ? 'text-danger' : 'text-text-primary'}>{String(value)}</span>
  </div>
);

export default function DebugConsole() {
  const { user, userProfile, company, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [dump, setDump] = useState({});
  const didAutoRunRef = useRef(false);
  const didRunWithCompanyRef = useRef(false);

  const envOk = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  const push = (msg, data) => {
    setLog((prev) => [...prev, { ts: new Date().toISOString(), msg, data }]);
  };

  const runChecks = async () => {
    setRunning(true);
    setLog([]);
    const result = {};
    // Watchdog para garantir que a UI não fique travada se algum await nunca resolver
    let watchdog;
    try {
      push('ENV', { url: !!import.meta.env.VITE_SUPABASE_URL, key: !!import.meta.env.VITE_SUPABASE_ANON_KEY });
      // inicia watchdog (12s)
      watchdog = setTimeout(() => {
        push('watchdog', { warning: 'runChecks timeout geral após 12s' });
        setRunning(false);
      }, 12000);

      const withTimeout = async (promise, ms, label) => {
        push('await:start', { label, ms });
        let timer;
        try {
          const wrapped = Promise.race([
            promise,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
            })
          ]);
          const res = await wrapped;
          push('await:done', { label });
          return res;
        } catch (e) {
          push('await:error', { label, error: e?.message });
          throw e;
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      // Fallback rápido: tenta ler direto do localStorage enquanto o SDK resolve
      const readLocalSession = () => {
        try {
          if (typeof window === 'undefined') return null;
          const k = Object.keys(window.localStorage || {}).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'));
          if (!k) return null;
          const sess = JSON.parse(window.localStorage.getItem(k) || 'null');
          return sess?.access_token ? { session: sess } : null;
        } catch {
          return null;
        }
      };

      const sessionRace = Promise.race([
        supabase.auth.getSession(),
        new Promise((resolve) => setTimeout(() => resolve({ data: readLocalSession(), error: null }), 400))
      ]);
      const { data: sessionRes, error: sessErr } = await withTimeout(sessionRace, 8000, 'auth.getSession');
      const hasSess = !!(sessionRes?.session?.access_token || sessionRes?.session);
      push('auth.getSession', { hasSession: hasSess, source: sessionRes?.session?.access_token ? 'local' : 'sdk', error: sessErr?.message });
      result.session = (sessionRes && (sessionRes.session || sessionRes)) || null;

      let userRes = null;
      try {
        const { data } = await withTimeout(supabase.auth.getUser(), 12000, 'auth.getUser');
        userRes = data || null;
        push('auth.getUser', { userId: userRes?.user?.id || null });
      } catch (e) {
        // Tratar timeout como não-fatal: seguir usando o session.user
        if (String(e?.message || '').startsWith('timeout:auth.getUser')) {
          push('auth.getUser:timeout', { fallbackToSessionUser: !!result?.session?.user?.id });
        } else {
          push('auth.getUser:error', { error: e?.message });
        }
      }
      result.user = userRes?.user || null;

      // colaboradores
      const effectiveUserId = (userRes?.user?.id) || (result?.session?.user?.id);
      if (effectiveUserId) {
        const { data: perfil, error } = await withTimeout(
          supabase
          .from('colaboradores')
          .select('*')
          .eq('id', effectiveUserId)
          .maybeSingle(),
          3000,
          'colaboradores.byUser'
        );
        push('colaboradores.byUser', { ok: !error && !!perfil, codigo_empresa: perfil?.codigo_empresa || null, error: error?.message });
        result.colaborador = perfil || null;

        if (perfil?.codigo_empresa) {
          const { data: emp, error: empErr } = await withTimeout(
            supabase
            .from('empresas')
            .select('*')
            .eq('codigo_empresa', perfil.codigo_empresa)
            .maybeSingle(),
            3000,
            'empresas.byId'
          );
          push('empresas.byId', { ok: !empErr && !!emp, error: empErr?.message });
          result.empresa = emp || null;

          const { data: quadras, error: qErr } = await withTimeout(
            supabase
            .from('quadras')
            .select('id,nome')
            .eq('codigo_empresa', perfil.codigo_empresa)
            .order('nome', { ascending: true })
            .limit(5),
            3000,
            'quadras.byEmpresa'
          );
          push('quadras.byEmpresa', { count: quadras?.length || 0, error: qErr?.message });
          result.quadras = quadras || [];

          const { data: clientes, error: cErr } = await withTimeout(
            supabase
            .from('clientes')
            .select('id,nome,codigo,status')
            .eq('codigo_empresa', perfil.codigo_empresa)
            .order('nome', { ascending: true })
            .limit(5),
            3000,
            'clientes.byEmpresa'
          );
          push('clientes.byEmpresa', { count: clientes?.length || 0, error: cErr?.message });
          result.clientes = clientes || [];
        }
      }
    } catch (e) {
      push('exception', { error: e?.message });
    } finally {
      if (watchdog) clearTimeout(watchdog);
      setDump(result);
      setRunning(false);
    }
  };

  useEffect(() => {
    // Auto-run apenas uma vez por reload quando o usuário fica disponível
    if (!authLoading && user && open && !running && !didAutoRunRef.current) {
      didAutoRunRef.current = true;
      runChecks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    // Rodar mais uma vez quando a company ficar disponível pela primeira vez
    if (!authLoading && user && company?.id && open && !running && !didRunWithCompanyRef.current) {
      didRunWithCompanyRef.current = true;
      runChecks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, authLoading, user]);

  if (authLoading || !user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] max-h-[60vh] bg-surface/95 backdrop-blur rounded-lg border border-border shadow-xl flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="text-xs font-semibold">Debug Console</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => runChecks()} disabled={running}>
            {running ? 'Executando...' : 'Executar' }
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
        </div>
      </div>
      <div className="p-3 overflow-auto">
        <Line label="ENV OK" value={envOk} />
        <Line label="User" value={user?.id || 'null'} />
        <Line label="Empresa (ctx)" value={userProfile?.codigo_empresa || 'null'} />
        <Line label="Company ctx" value={company?.id || 'null'} />
        <div className="h-2" />
        <div className="text-[10px] text-text-secondary uppercase">Logs</div>
        <pre className="mt-1 text-[11px] leading-tight whitespace-pre-wrap text-text-primary">
          {log.map((l, i) => `• ${l.ts}  ${l.msg} ${l.data ? JSON.stringify(l.data) : ''}`).join('\n')}
        </pre>
        <div className="h-2" />
        <div className="text-[10px] text-text-secondary uppercase">Dump</div>
        <pre className="mt-1 text-[11px] leading-tight whitespace-pre overflow-auto bg-background p-2 rounded">
          {JSON.stringify(dump, null, 2)}
        </pre>
      </div>
    </div>
  );
}
