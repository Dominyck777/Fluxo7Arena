import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReleaseNotesModal from '@/components/ReleaseNotesModal';
import { APP_VERSION, RELEASE_NOTES } from '@/lib/releaseNotes';

export default function ReleaseNotesPreviewPage() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search || ''), [location.search]);
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);

  const previewKey = params.get('key') || '';
  const envKey = String(import.meta.env.VITE_RELEASE_PREVIEW_KEY || '');
  const allow = (() => {
    try {
      if (!import.meta.env.PROD) return true;
      if (!envKey) return false;
      return previewKey === envKey;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!allow) return;
    if (params.get('open') === '1') setOpen(true);
  }, [allow, params]);

  useEffect(() => {
    if (!allow) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('/release-notes.json', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setPayload(json);
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [allow]);

  const versionLabel = payload?.versionLabel || payload?.version || APP_VERSION;
  const items = Array.isArray(payload?.items) ? payload.items : RELEASE_NOTES;

  if (!allow) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="text-lg font-semibold">Acesso negado</div>
          <div className="mt-2 text-sm text-text-secondary">Essa rota é apenas para pré-visualização.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl space-y-4">
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="text-xl font-semibold">Preview - Modal de Novidades</div>
          <div className="mt-1 text-sm text-text-secondary">Versão atual: {versionLabel}</div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-black font-medium hover:opacity-90"
            >
              Abrir modal
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-text-primary hover:bg-surface-2"
            >
              Fechar modal
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="text-sm font-semibold">Itens atuais</div>
          <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-text-secondary">
            {(items || []).map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        </div>
      </div>

      <ReleaseNotesModal open={open} onOpenChange={setOpen} versionLabel={versionLabel} items={items} />
    </div>
  );
}
