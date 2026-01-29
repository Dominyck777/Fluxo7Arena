import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { APP_VERSION, RELEASE_NOTES } from '@/lib/releaseNotes';

export default function ReleaseNotesModal({ open, onOpenChange, title, versionLabel, items, footer }) {
  const effectiveVersion = versionLabel || APP_VERSION;
  const effectiveItems = items || RELEASE_NOTES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" overlayClassName="bg-black/50 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle>
            {title ? (
              title
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>Novidades da versão</span>
                <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-base font-semibold leading-none text-brand">
                  {effectiveVersion}
                </span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <ul className="list-disc pl-5 space-y-2 text-sm text-text-secondary">
              {(effectiveItems || []).map((it, idx) => (
                <li key={idx} className="text-text-secondary">
                  <span className="text-text-primary">{it}</span>
                </li>
              ))}
            </ul>
          </div>

          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
