"use client";

import { useEffect, useState } from "react";

export interface CoachSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  // Fetcher returns the markdown/plain text to display. If null, sheet shows loading.
  fetcher?: () => Promise<{ text?: string; error?: string }>;
  // If passing static content directly:
  staticContent?: string;
  footer?: React.ReactNode;
}

export default function CoachSheet({
  open,
  title,
  onClose,
  fetcher,
  staticContent,
  footer,
}: CoachSheetProps) {
  const [content, setContent] = useState<string | null>(staticContent ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !fetcher || staticContent) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    fetcher()
      .then((r) => {
        if (cancelled) return;
        if (r.error) setError(r.error);
        else setContent(r.text ?? "");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Something went wrong");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetcher, staticContent]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 m-0 sm:m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--fg-muted)] text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {loading && (
          <p className="text-sm text-[var(--fg-muted)]">Thinking…</p>
        )}
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        {content && (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
        )}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}
