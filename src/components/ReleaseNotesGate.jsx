import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ReleaseNotesModal from '@/components/ReleaseNotesModal';

const SCOPE = 'release_notes';

export default function ReleaseNotesGate() {
  const { user, authReady } = useAuth();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const openedForReleaseRef = useRef(null);

  const eligible = Boolean(authReady && user?.id);

  const releaseId = payload?.releaseId || null;
  const versionLabel = payload?.versionLabel || payload?.version || null;
  const items = Array.isArray(payload?.items) ? payload.items : null;

  const cacheBuster = useMemo(() => {
    try { return Date.now(); } catch { return 0; }
  }, []);

  useEffect(() => {
    if (!eligible) return;
    if (checkingRef.current) return;

    let cancelled = false;
    const run = async () => {
      checkingRef.current = true;
      setChecking(true);
      try {
        try {
          console.log('[ReleaseNotesGate] Checando release notes...', { userId: user.id });
        } catch {}
        // 1) Carregar release-notes.json (publicado no root)
        const url = `/release-notes.json?v=${cacheBuster}`;
        const absUrl = (() => {
          try { return new URL(url, window.location.origin).toString(); } catch { return url; }
        })();
        try {
          console.log('[ReleaseNotesGate] Fetch URL:', absUrl);
        } catch {}

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = setTimeout(() => {
          try { controller?.abort(); } catch {}
        }, 8000);

        let res;
        try {
          res = await fetch(absUrl, {
            cache: 'no-store',
            signal: controller?.signal,
          });
        } catch (e) {
          console.warn('[ReleaseNotesGate] Falha no fetch release-notes.json:', e);
          return;
        } finally {
          try { clearTimeout(timeoutId); } catch {}
        }
        if (!res.ok) {
          try {
            console.warn('[ReleaseNotesGate] release-notes.json não encontrado/erro:', { status: res.status, url });
          } catch {}
          return;
        }

        let json = null;
        try {
          json = await res.json();
        } catch (e) {
          console.warn('[ReleaseNotesGate] Falha ao parsear release-notes.json:', e);
          return;
        }
        if (cancelled) return;

        try {
          console.log('[ReleaseNotesGate] release-notes.json carregado:', json);
        } catch {}

        const rid = String(json?.releaseId || '').trim();
        if (!rid) return;

        // Evitar reabrir para o mesmo release nesta sessão
        if (openedForReleaseRef.current === rid) return;

        // 2) Ver se o usuário já viu esse release
        const { data, error } = await supabase
          .from('user_ui_settings')
          .select('settings')
          .eq('user_id', user.id)
          .eq('scope', SCOPE)
          .maybeSingle();

        if (error) {
          console.warn('[ReleaseNotesGate] Falha ao ler user_ui_settings:', error);
          return;
        }

        const lastSeen = String(data?.settings?.last_seen_release_id || '').trim();
        try {
          console.log('[ReleaseNotesGate] Comparação release:', { rid, lastSeen });
        } catch {}
        if (lastSeen === rid) return;

        setPayload(json);
        openedForReleaseRef.current = rid;
        try {
          console.log('[ReleaseNotesGate] Abrindo modal de release notes...', { rid });
        } catch {}
        setTimeout(() => {
          try { if (!cancelled) setOpen(true); } catch {}
        }, 0);
      } catch (e) {
        console.warn('[ReleaseNotesGate] Erro ao checar release notes:', e);
      } finally {
        checkingRef.current = false;
        if (!cancelled) setChecking(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [eligible, user?.id, cacheBuster]);

  const markSeen = async (rid) => {
    try {
      if (!user?.id || !rid) return;
      const settings = {
        last_seen_release_id: String(rid),
        seen_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_ui_settings')
        .upsert(
          {
            user_id: user.id,
            scope: SCOPE,
            settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,scope' }
        );

      if (error) {
        console.warn('[ReleaseNotesGate] Falha ao salvar release seen:', error);
      }
    } catch (e) {
      console.warn('[ReleaseNotesGate] Erro ao salvar release seen:', e);
    }
  };

  const handleOpenChange = (nextOpen) => {
    // Quando fechar (clicar fora/ESC/X/Entendi), marca como visto.
    if (open && !nextOpen) {
      void markSeen(releaseId);
    }
    setOpen(nextOpen);
  };

  if (!eligible) return null;

  return (
    <ReleaseNotesModal
      open={open}
      onOpenChange={handleOpenChange}
      versionLabel={versionLabel}
      items={items}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-black font-medium hover:opacity-90"
          >
            Entendi
          </button>
        </div>
      }
    />
  );
}
