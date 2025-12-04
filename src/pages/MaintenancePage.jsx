import React, { useMemo, useState } from 'react';
import { Ban, Clock, Calendar, ShieldAlert, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import IsisAvatar from '@/components/isis/IsisAvatar';

const PASSWORD = '40028922';

function fmt(dt) {
  try {
    return format(dt, "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR });
  } catch {
    return '';
  }
}

export default function MaintenancePage() {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');

  // Env config
  const active = String(import.meta.env.VITE_MAINTENANCE_MODE || '').toLowerCase() === 'true';
  const endRaw = import.meta.env.VITE_MAINTENANCE_END || '';
  const customText = import.meta.env.VITE_MAINTENANCE_TEXT || '';

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

  const handleBypass = (e) => {
    e.preventDefault();
    setError('');
    if ((pwd || '').trim() === PASSWORD) {
      try { localStorage.setItem('maintenance:bypass', '1'); } catch {}
      window.location.assign('/login');
      return;
    }
    setError('Senha incorreta.');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#0f1324] via-[#0b0f1c] to-[#070a14] text-white">
      {/* Glow background */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[90rem] h-[90rem] rounded-full opacity-30 blur-3xl"
           style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(76,110,245,0.45) 0%, rgba(76,110,245,0.18) 40%, rgba(0,0,0,0) 70%)' }} />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 md:py-24">
        <div className="flex items-center justify-center gap-3 mb-6 text-brand">
          <Sparkles className="w-5 h-5 text-brand" />
          <span className="uppercase tracking-[0.2em] text-xs text-brand/80">F7 Arena</span>
        </div>

        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-[0_0_60px_-10px_rgba(76,110,245,0.5)] p-6 md:p-10">
          <div className="flex items-center justify-center gap-3 text-red-400 mb-4">
            <Ban className="w-6 h-6" />
            <span className="font-semibold tracking-wide">Modo de Manutenção</span>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute -inset-4 bg-brand/20 blur-2xl rounded-full" />
                <div className="relative rounded-2xl p-1 bg-gradient-to-b from-brand/40 to-transparent">
                  <IsisAvatar size={112} />
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

              <form onSubmit={handleBypass} className="mt-8">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-white/80 mb-3">
                    <ShieldAlert className="w-5 h-5 text-brand" />
                    <span className="font-medium">Acesso de manutenção</span>
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="Senha de acesso"
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-brand/60 placeholder-white/40"
                    />
                    <button
                      type="submit"
                      className="rounded-xl px-5 py-3 bg-brand hover:bg-brand/90 transition text-white font-medium shadow-lg shadow-brand/20"
                    >
                      Liberar Login
                    </button>
                  </div>
                  {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                  <p className="mt-2 text-xs text-white/50">Dica: use a senha fornecida pela equipe para acessar a tela de login.</p>
                </div>
              </form>
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
