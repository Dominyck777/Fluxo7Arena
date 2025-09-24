import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const lastLoadedUserIdRef = useRef(null);
  const loadingProfileRef = useRef(false);

  useEffect(() => {
    // 0) Checagem de logout forçado para evitar re-login imediato pós redirect
    const forceLogout = (() => {
      try { return sessionStorage.getItem('auth:forceLogout') === '1'; } catch { return false; }
    })();
    if (forceLogout) {
      // Limpa qualquer cache e garante estado deslogado nesta carga
      try {
        localStorage.removeItem('auth:userProfile');
        localStorage.removeItem('auth:company');
      } catch {}
      setUser(null);
      setUserProfile(null);
      setCompany(null);
      setAuthReady(true);
      setLoading(false);
      try { sessionStorage.removeItem('auth:forceLogout'); } catch {}
      // Garantir signOut global em background
      try { supabase.auth.signOut({ scope: 'global' }).catch(() => {}); } catch {}
      return; // não hidratar caches nem consultar sessão nesta carga
    }

    // 1) Hidratar caches locais para evitar UI vazia após reload
    try {
      const cachedProfile = localStorage.getItem('auth:userProfile');
      const cachedCompany = localStorage.getItem('auth:company');
      if (cachedProfile) setUserProfile(JSON.parse(cachedProfile));
      if (cachedCompany) setCompany(JSON.parse(cachedCompany));
      if (cachedProfile || cachedCompany) {
        setAuthReady(true);
      }
    } catch (e) {
      console.warn('AuthContext: falha ao hidratar cache local:', e);
    }

    // 2) Verificar sessão atual
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('supabase.auth.getSession error:', error);
        }
        if (session?.user) {
          setUser(session.user);
          // Libera authReady imediatamente para evitar travar a UI no reload;
          // o carregamento de perfil/empresa acontece em background.
          setAuthReady(true);
          await loadUserProfile(session.user.id);
          lastLoadedUserIdRef.current = session.user.id;
        } else {
          // Sem sessão: liberar imediatamente a UI pública
          setAuthReady(true);
        }
      } catch (e) {
        console.error('getSession exception:', e);
      } finally {
        // Não liberar authReady aqui para evitar condição de corrida no reload
        setLoading(false);
      }
    };

    getSession();

    // Escutar mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] onAuthStateChange', { event, userId: session?.user?.id || null });
      try {
        if (event === 'SIGNED_OUT') {
          try {
            localStorage.removeItem('auth:userProfile');
            localStorage.removeItem('auth:company');
          } catch {}
          setUser(null);
          setUserProfile(null);
          setCompany(null);
          lastLoadedUserIdRef.current = null;
          loadingProfileRef.current = false;
          setLoading(false);
          setAuthReady(true);
          return;
        }

        const nextUser = session?.user || null;
        setUser(nextUser);
        setAuthReady(true);

        if (nextUser?.id) {
          // Evita múltiplas cargas concorrentes; o próprio loadUserProfile tem single-flight
          await loadUserProfile(nextUser.id);
          lastLoadedUserIdRef.current = nextUser.id;
          setLoading(false);
        }
      } catch (e) {
        console.error('onAuthStateChange handler error:', e);
        setLoading(false);
        setAuthReady(true);
      }
    });

    // Failsafe para nunca travar em loading em caso de ambientes com cache quebrado
    const failsafe = setTimeout(() => {
      // Em último caso, libera a UI para evitar travar no spinner eterno
      setLoading(prev => (prev ? false : prev));
      setAuthReady(prev => (prev ? prev : true));
    }, 12000);

    return () => { clearTimeout(failsafe); authListener.subscription.unsubscribe(); };
  }, []);

  // Recuperação após navegação: se o usuário está autenticado mas o contexto está sem perfil/empresa,
  // tente recarregar para evitar listas vazias quando alterna de abas/rotas.
  useEffect(() => {
    const recover = async () => {
      try {
        if (!authReady) return;
        if (!user) return;
        const needProfile = !userProfile;
        const needCompany = !!userProfile && !company && !!(userProfile.codigo_empresa);
        if (needProfile || needCompany) {
          await loadUserProfile(user.id);
          lastLoadedUserIdRef.current = user.id;
        }
      } catch {}
    };
    recover();
  }, [authReady, user?.id, !!userProfile, userProfile?.codigo_empresa, !!company]);

  // Idle Watchdog: ao voltar o foco/visibilidade, reidrata cache e dispara refresh em background
  useEffect(() => {
    const rehydrateFromCache = () => {
      try {
        const cachedProfile = localStorage.getItem('auth:userProfile');
        const cachedCompany = localStorage.getItem('auth:company');
        if (cachedProfile) {
          const p = JSON.parse(cachedProfile);
          if (!userProfile || !userProfile.codigo_empresa) setUserProfile(p);
        }
        if (cachedCompany) {
          const c = JSON.parse(cachedCompany);
          if (!company || !company.codigo_empresa) setCompany(c);
        }
      } catch {}
    };
    const onFocus = () => {
      rehydrateFromCache();
      // Dispara refresh de perfil/empresa em background se houver sessão
      if (user?.id) {
        loadUserProfile(user.id).catch(() => {});
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadUserProfile = async (userId) => {
    if (loadingProfileRef.current) {
      console.log('[AuthDebug] loadUserProfile:skip (already running)');
      return;
    }
    loadingProfileRef.current = true;
    try {
      const delays = [300, 800, 1600, 3000];
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const withTimeout = async (promise, ms) => {
        let timer;
        try {
          const timeout = new Promise((resolve) => {
            timer = setTimeout(() => resolve({ __timeout: true }), ms);
          });
          const result = await Promise.race([promise, timeout]);
          return result;
        } finally {
          clearTimeout(timer);
        }
      };
      const COLAB_TIMEOUT_MS = 1200;
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        console.log('[AuthDebug] loadUserProfile:start', { userId, attempt });
        try {
          // 1) Buscar apenas o colaborador (sem join) para evitar recursão de policies
          console.log('[AuthDebug] querying colaboradores', { userId });
          const colabPromise = supabase
            .from('colaboradores')
            .select('*')
            .eq('id', userId)
            .single();
          const colabResult = await withTimeout(colabPromise, COLAB_TIMEOUT_MS);

          if (colabResult && colabResult.__timeout) {
            console.warn('[AuthDebug] colaboradores:timeout, using usuarios fallback (inline)');
            try {
              console.log('[AuthDebug] fallback-inline: querying usuarios by id');
              const { data: usuario, error: uErr } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

              if (!uErr && usuario) {
                let resolvedEmpresa = null;
                if (usuario.codigo_empresa) {
                  console.log('[AuthDebug] fallback-inline: querying empresas by codigo', { codigo_empresa: usuario.codigo_empresa });
                  const { data: empByCode, error: empByCodeErr } = await supabase
                    .from('empresas')
                    .select('*')
                    .eq('codigo_empresa', usuario.codigo_empresa)
                    .single();
                  if (!empByCodeErr) {
                    resolvedEmpresa = empByCode;
                    console.log('[AuthDebug] fallback-inline: empresa loaded');
                  } else {
                    console.warn('[AuthDebug] fallback-inline: empresa error', { status: empByCodeErr.status, code: empByCodeErr.code, message: empByCodeErr.message });
                  }
                }

                const synthesizedProfile = {
                  id: userId,
                  nome: usuario.nome || null,
                  cargo: usuario.papel || 'user',
                  codigo_empresa: usuario.codigo_empresa || null,
                  _source: 'usuarios',
                };

                setUserProfile(synthesizedProfile);
                try { localStorage.setItem('auth:userProfile', JSON.stringify(synthesizedProfile)); } catch {}

                if (resolvedEmpresa) {
                  setCompany(resolvedEmpresa);
                  try { localStorage.setItem('auth:company', JSON.stringify(resolvedEmpresa)); } catch {}
                  console.log('[AuthDebug] fallback-inline: set company from usuarios path');
                } else {
                  // Preserve existing company (stale-while-revalidate) to avoid UI flicker across tabs
                  console.warn('[AuthDebug] fallback-inline: no company resolved; preserving previous company');
                  // Do not clear company or cache here
                }
                // sucesso via fallback: encerrar sem novas tentativas
                return;
              }
              if (uErr) {
                console.warn('[AuthDebug] fallback-inline: usuarios error', { status: uErr.status, code: uErr.code, message: uErr.message });
              }
            } catch (fe) {
              console.warn('[AuthDebug] fallback-inline: unexpected error', fe?.message || fe);
            }
            // Caso fallback-inline não resolva, continua laço para tentar novamente (com pequenos backoffs)
            if (attempt < delays.length) {
              await sleep(delays[attempt]);
              continue;
            }
            return;
          }

          const { data: profile, error } = colabResult || {};

          console.log('[AuthDebug] colaboradores:success', { hasProfile: !!profile, codigo_empresa: profile?.codigo_empresa || null });

          if (error) {
            console.warn('[AuthDebug] colaboradores:error', { code: error.code, status: error.status, message: error.message });
            // Tratar 42P17 como erro transitório (policies em atualização) e usar o mesmo backoff
            if (error.code === '42P17') {
              if (attempt < delays.length) {
                await sleep(delays[attempt]);
                continue;
              }
              // Última tentativa: registra e segue sem derrubar estado atual
              console.warn('RLS recursion (42P17) persistente ao carregar perfil. Prosseguindo sem alterar cache.');
              return;
            }
            // Tratar erros de autorização que podem causar logout forçado
            if ([401, 403].includes(Number(error.status))) {
              console.warn('[AuthDebug] Erro de autorização detectado, tentando fallback');
              if (attempt < delays.length) {
                await sleep(delays[attempt]);
                continue;
              }
            }
            // Sem registro em colaboradores para este usuário: tentar fallback via 'usuarios'
            if (error.code === 'PGRST116') { // No rows
              try {
                console.log('[AuthDebug] fallback: querying usuarios by id');
                const { data: usuario, error: uErr } = await supabase
                  .from('usuarios')
                  .select('*')
                  .eq('id', userId)
                  .maybeSingle();

                if (!uErr && usuario) {
                  // Resolver empresa via codigo_empresa
                  let resolvedEmpresa = null;
                  if (usuario.codigo_empresa) {
                    console.log('[AuthDebug] fallback: querying empresas by codigo', { codigo_empresa: usuario.codigo_empresa });
                    const { data: empByCode, error: empByCodeErr } = await supabase
                      .from('empresas')
                      .select('*')
                      .eq('codigo_empresa', usuario.codigo_empresa)
                      .single();
                    if (!empByCodeErr) {
                      resolvedEmpresa = empByCode;
                      console.log('[AuthDebug] fallback: empresa loaded');
                    } else {
                      console.warn('[AuthDebug] fallback: empresa error', { status: empByCodeErr.status, code: empByCodeErr.code, message: empByCodeErr.message });
                    }
                  }

                  const synthesizedProfile = {
                    id: userId,
                    nome: usuario.nome || null,
                    cargo: usuario.papel || 'user',
                    codigo_empresa: usuario.codigo_empresa || null,
                    _source: 'usuarios',
                  };

                  setUserProfile(synthesizedProfile);
                  try { localStorage.setItem('auth:userProfile', JSON.stringify(synthesizedProfile)); } catch {}

                  if (resolvedEmpresa) {
                    setCompany(resolvedEmpresa);
                    try { localStorage.setItem('auth:company', JSON.stringify(resolvedEmpresa)); } catch {}
                    console.log('[AuthDebug] fallback: set company from usuarios path');
                  } else {
                    // Preserve existing company (stale-while-revalidate) to avoid UI flicker across tabs
                    console.warn('[AuthDebug] fallback: no company resolved; preserving previous company');
                    // Do not clear company or cache here
                  }
                  return;
                }
                if (uErr) {
                  console.warn('[AuthDebug] fallback: usuarios error', { status: uErr.status, code: uErr.code, message: uErr.message });
                }
              } catch {}

              // Fallback falhou: não sobrescrever cache atual (evita sumiço ao navegar)
              console.warn('AuthContext: perfil não encontrado (PGRST116) e fallback falhou; mantendo cache atual.');
              return;
            }
            // Status de autorização temporária (token/rls ainda não pronto)
            const transient = [401, 403, 406].includes(Number(error.status));
            if (transient && attempt < delays.length) {
              await sleep(delays[attempt]);
              continue;
            }
            throw error;
          }

          if (!profile) {
            // Resposta vazia sem erro (ex.: atraso de policies/token). Não sobrescrever cache.
            if (attempt < delays.length) {
              await sleep(delays[attempt]);
              continue;
            }
            // Última tentativa: manter estado atual
            return;
          }

          setUserProfile(profile);
          try { localStorage.setItem('auth:userProfile', JSON.stringify(profile)); } catch {}

          // 2) Buscar a empresa em chamada separada, se disponível (por codigo_empresa)
          if (profile?.codigo_empresa) {
            console.log('[AuthDebug] company: querying empresas by codigo from colaboradores', { codigo_empresa: profile.codigo_empresa });
            const { data: empresa, error: empErr } = await supabase
              .from('empresas')
              .select('*')
              .eq('codigo_empresa', profile.codigo_empresa)
              .single();

            if (!empErr) {
              setCompany(empresa);
              try { localStorage.setItem('auth:company', JSON.stringify(empresa)); } catch {}
              console.log('[AuthDebug] company: set from colaboradores path');
            } else {
              // Se falhar por autorização, não limpe imediatamente em tentativas intermediárias
              const transientEmp = [401, 403, 406].includes(Number(empErr.status));
              if (transientEmp && attempt < delays.length) {
                await sleep(delays[attempt]);
                continue;
              }
              // Non-transient or repeated error: preserve previous company (stale-while-revalidate)
              console.warn('[AuthDebug] company: load error; preserving previous company', { status: empErr.status, code: empErr.code, message: empErr.message });
              // Do not clear existing company/cache to avoid flicker across tabs
              return;
            }
          } else {
            // Profile has no codigo_empresa at the moment; preserve existing company to avoid flicker
            console.warn('[AuthDebug] company: no codigo_empresa available on profile; preserving previous company');
            // Do not clear existing company/cache here
          }
          return; // sucesso
        } catch (error) {
          // Erro inesperado; repetir apenas enquanto houver tentativas
          console.error('[AuthDebug] loadUserProfile:unexpected error', { message: error?.message, code: error?.code, status: error?.status });
          if (attempt < delays.length) {
            await sleep(delays[attempt]);
            continue;
          }
          console.error('Error loading user profile:', error);
          return;
        }
      }
    } finally {
      loadingProfileRef.current = false;
    }
  };

  const signUp = async (email, password, name, empresaCodigo = null) => {
    try {
      // Criar usuário no Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Se for informado um código de empresa, vincular colaborador à empresa correspondente
      if (data?.user && empresaCodigo) {
        const { data: empresa, error: empErr } = await supabase
          .from('empresas')
          .select('id, codigo_empresa')
          .eq('codigo_empresa', empresaCodigo)
          .single();

        if (empErr) {
          throw new Error('Código de empresa inválido. Verifique o código informado.');
        }

        const { error: profileError } = await supabase
          .from('colaboradores')
          .insert({
            id: data.user.id,
            codigo_empresa: empresa.codigo_empresa,
            nome: name,
            cargo: 'user',
            ativo: true,
          });
        if (profileError) throw profileError;
      }

      return { data, error: null };
    } catch (error) {
      let message = 'Não foi possível cadastrar. Verifique os dados e tente novamente.';
      const raw = (error?.message || '').toLowerCase();
      if (raw.includes('user already registered') || raw.includes('already registered') || raw.includes('user already exists')) {
        message = 'Email já cadastrado. Tente entrar ou redefinir a senha.';
      } else if (raw.includes('password') && raw.includes('length')) {
        message = 'Senha muito curta. Use ao menos 6 caracteres.';
      }
      return { data: null, error: new Error(message) };
    }
  };

  const signIn = async (email, password) => {
    try {
      // Fazer login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let message = 'Não foi possível entrar. Tente novamente.';
        const raw = (error.message || '').toLowerCase();
        const status = error.status;
        if (raw.includes('invalid login') || raw.includes('invalid credentials') || status === 400) {
          message = 'Email ou senha inválidos.';
        } else if (raw.includes('email not confirmed') || raw.includes('not confirmed')) {
          message = 'Email não confirmado. Verifique sua caixa de entrada.';
        } else if (status === 429) {
          message = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        } else if (status >= 500) {
          message = 'Serviço indisponível no momento. Tente novamente mais tarde.';
        }
        return { data: null, error: new Error(message) };
      }

      // Verificar se usuário tem cadastro em 'colaboradores'. Se não tiver, apenas segue; criação agora ocorre via fluxo de cadastro de funcionário.
      if (data.user) {
        await supabase
          .from('colaboradores')
          .select('id')
          .eq('id', data.user.id)
          .single();
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  const signOut = async () => {
    // Solicitar signOut global e aguardar brevemente para propagar aos outros contextos/abas
    try {
      const signOutPromise = supabase.auth.signOut({ scope: 'global' });
      const shortTimeout = new Promise((resolve) => setTimeout(resolve, 700));
      await Promise.race([signOutPromise, shortTimeout]);
    } catch (e) {
      console.warn('[AuthContext] signOut(): error during signOut', e?.message || e);
    }
    // Limpar estado em memória imediatamente
    lastLoadedUserIdRef.current = null;
    setUser(null);
    setUserProfile(null);
    setCompany(null);
    setLoading(false);
    setAuthReady(true);
    // Limpar caches locais para evitar estado obsoleto pós logout
    try {
      localStorage.removeItem('auth:userProfile');
      localStorage.removeItem('auth:company');
      localStorage.removeItem('clientes:list');
      localStorage.removeItem('quadras:list');
      localStorage.removeItem('agenda:courts');
      // Filtros/seleções da agenda
      localStorage.removeItem('agenda:selectedCourts');
      localStorage.removeItem('agenda:viewFilter');
      // Agendamentos por dia (prefixo agenda:bookings:...)
      Object.keys(localStorage)
        .filter((k) => k.startsWith('agenda:bookings:'))
        .forEach((k) => localStorage.removeItem(k));
      // Remover possíveis tokens do Supabase imediatamente (evita re-login na recarga)
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {}
    // Marcar logout forçado e redirecionar (replace evita voltar para rota privada via back)
    try { sessionStorage.setItem('auth:forceLogout', '1'); } catch {}
    try { window.location.replace('/'); } catch {}
    return { error: null };
  };

  // Permite que telas atualizem os dados da empresa no header após um update
  const reloadCompany = async () => {
    try {
      const codigo = (userProfile && userProfile.codigo_empresa) ? userProfile.codigo_empresa : null;
      if (!codigo) return;
      const { data: empresa, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('codigo_empresa', codigo)
        .single();
      if (!error && empresa) {
        setCompany(empresa);
        try { localStorage.setItem('auth:company', JSON.stringify(empresa)); } catch {}
      }
    } catch (e) {
      // silencioso: não quebrar UX
    }
  };

  const value = {
    user,
    userProfile,
    company,
    loading,
    authReady,
    signUp,
    signIn,
    signOut,
    reloadCompany,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};