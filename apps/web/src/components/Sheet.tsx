"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Mobilda pastdan chiqadigan, katta ekranda markazdagi oyna.
 * Faqat transform/opacity animatsiyasi.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal>
      <div
        className={`absolute inset-0 bg-espresso/50 transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        ref={panel}
        tabIndex={-1}
        className={`relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-soft outline-none ring-1 ring-line transition-[transform,opacity] duration-250 ease-out-soft sm:max-w-lg sm:rounded-[28px] sm:p-7 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="mb-5 flex items-start justify-between gap-4">
          {title && <h2 className="font-serif text-2xl leading-tight">{title}</h2>}
          <button
            onClick={onClose}
            className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
