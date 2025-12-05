// Bypass de manutenção: parâmetro de URL -> ?senha=f740028922
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ban, Clock, Calendar, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IsisAvatar } from '@/components/isis/IsisAvatar';
import { DEFAULT_MAINTENANCE_END, DEFAULT_MAINTENANCE_TEXT, FORCE_MAINTENANCE } from '@/lib/maintenanceConfig';

const PASSWORD = 'f740028922';

function fmt(dt) {
  try {
    return format(dt, "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR });
  } catch {
    return '';
  }
}

export default function MaintenancePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const active = Boolean(FORCE_MAINTENANCE) || (typeof window !== 'undefined' && (localStorage.getItem('maintenance:active') === 'true'));
  const [endLocal, setEndLocal] = useState('');
  const [textLocal, setTextLocal] = useState('');

  useEffect(() => {
    try {
      setEndLocal(localStorage.getItem('maintenance:end') || '');
      setTextLocal(localStorage.getItem('maintenance:message') || '');
      const onStorage = (e) => {
        if (e.key === 'maintenance:end') setEndLocal(e.newValue || '');
        if (e.key === 'maintenance:message') setTextLocal(e.newValue || '');
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    } catch {}
  }, []);

  const endRaw = endLocal || DEFAULT_MAINTENANCE_END || (import.meta.env.VITE_MAINTENANCE_END || '');
  const customText = (textLocal && textLocal.trim()) ? textLocal : (DEFAULT_MAINTENANCE_TEXT || (import.meta.env.VITE_MAINTENANCE_TEXT || ''));

  const endDate = useMemo(() => {
    if (!endRaw) return null;
    const d = new Date(endRaw);
    return isNaN(d.getTime()) ? null : d;
  }, [endRaw]);

  const message = useMemo(() => {
    const base = customText?.trim()
      ? customText
      : endDate
        ? `Estamos em manutenção e voltaremos até ${fmt(endDate)}.`
        : 'Estamos em manutenção no momento. Voltaremos em breve.';
    return base;
  }, [customText, endDate]);

  // Expor uma API simples via console: window.f7MaintenanceBypass('senha')
  useEffect(() => {
    try {
      window.f7MaintenanceBypass = (code) => {
        const ok = String(code || '') === PASSWORD;
        if (ok) {
          try { localStorage.setItem('maintenance:bypass', '1'); } catch {}
          try { sessionStorage.setItem('maintenance:bypass', '1'); } catch {}
          try { document.cookie = 'fx_maint_bypass=1; path=/; max-age=2592000'; } catch {}
          try { sessionStorage.removeItem('auth:returnUrl'); } catch {}
          navigate('/login', { replace: true });
        } else {
          console.warn('[Maintenance] Senha inválida.');
        }
        return ok;
      };
      window.f7MaintenanceReset = () => {
        try { localStorage.removeItem('maintenance:bypass'); } catch {}
        console.info('[Maintenance] Bypass removido.');
      };
    } catch {}
  }, [navigate]);

  useEffect(() => {
    const path = String(location.pathname || '');
    const parts = path.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const search = new URLSearchParams(location.search || '');
    const code = search.get('senha') || search.get('pwd') || search.get('code') || '';
    const candidate = code || last;
    if (candidate && candidate === PASSWORD) {
      try { localStorage.setItem('maintenance:bypass', '1'); } catch {}
      try { sessionStorage.setItem('maintenance:bypass', '1'); } catch {}
      try { document.cookie = 'fx_maint_bypass=1; path=/; max-age=2592000'; } catch {}
      try { sessionStorage.removeItem('auth:returnUrl'); } catch {}
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#0f1324] via-[#0b0f1c] to-[#070a14] text-white">
      {/* Glow background */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[90rem] h-[90rem] rounded-full opacity-30 blur-3xl"
           style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(76,110,245,0.45) 0%, rgba(76,110,245,0.18) 40%, rgba(0,0,0,0) 70%)' }} />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-[0_0_60px_-10px_rgba(76,110,245,0.5)] p-6 md:p-10">
          {/* Logo estilo da tela de login */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-brand rounded-xl flex items-center justify-center mr-4">
                <Trophy className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-5xl font-extrabold">
                  <span style={{ color: '#FF6600' }}>Fluxo</span>
                  <span style={{ color: '#FFAA33' }}>7</span>
                </h1>
                <p className="text-2xl font-semibold" style={{ color: '#B0B0B0' }}>Arena</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-red-400 mb-4">
            <Ban className="w-6 h-6" />
            <span className="font-semibold tracking-wide">Modo de Manutenção</span>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute -inset-4 bg-brand/20 blur-2xl rounded-full" />
                <div className="relative rounded-2xl p-1 bg-gradient-to-b from-brand/40 to-transparent">
                  <IsisAvatar size="xl" variant="header" />
                </div>
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">Oi! Eu sou a Isis 👋</h1>
              <p className="text-white/80 mt-3 text-base md:text-lg leading-relaxed">
                {message}
              </p>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
                {endDate && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <Clock className="w-4 h-4 text-brand" />
                    <span>Previsão de retorno: <strong className="text-white/90">{fmt(endDate)}</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <Calendar className="w-4 h-4 text-brand" />
                  <span>Vamos cuidar de tudo para você jogar melhor ⚽🏐🏀</span>
                </div>
              </div>

              {/* Removido input de senha. Para liberar via console:
                  window.f7MaintenanceBypass('f740028922') */}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-white/50 text-sm">
          {active ? 'Modo de manutenção ativo' : 'Modo de manutenção inativo'}
        </p>
      </div>
    </div>
  );
}
