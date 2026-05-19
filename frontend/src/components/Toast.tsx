import clsx from "clsx";

import { useToast } from "../hooks/useToast";
import type { ToastVariant } from "../hooks/useToast";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-slate-800 text-white",
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-4">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg ring-1 ring-black/5",
              VARIANT_STYLES[t.variant]
            )}
            role="status"
          >
            <div className="flex-1 text-sm leading-snug">{t.message}</div>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25"
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
