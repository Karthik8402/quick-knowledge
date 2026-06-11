import type { ReactNode } from 'react';

type Tone = 'danger' | 'info';

type ConfirmToastProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: Tone;
  busy?: boolean;
  extra?: ReactNode;
};

const toneMap: Record<Tone, {
  icon: string;
  iconName: string;
  confirm: string;
  cancel: string;
}> = {
  danger: {
    icon: 'text-error',
    iconName: 'warning',
    confirm: 'bg-error hover:bg-error/90 text-white rounded-md px-4 py-2',
    cancel: 'bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface rounded-md px-4 py-2',
  },
  info: {
    icon: 'text-primary',
    iconName: 'info',
    confirm: 'bg-primary hover:bg-primary/90 text-white rounded-md px-4 py-2',
    cancel: 'bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface rounded-md px-4 py-2',
  },
};

export default function ConfirmToast({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'danger',
  busy = false,
  extra,
}: ConfirmToastProps) {
  if (!open) return null;
  const styles = toneMap[tone];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="w-[92%] max-w-md animate-scale-in">
        <div className="bg-surface border border-outline-variant rounded-xl shadow-lg p-6 flex items-start gap-3">
          <span className={`material-symbols-outlined ${styles.icon} text-xl mt-0.5`}>{styles.iconName}</span>
          <div className="flex-grow min-w-0">
            <p className="text-on-surface font-semibold text-sm">{title}</p>
            <p className="text-on-surface-variant text-xs mt-0.5 leading-relaxed">{message}</p>
            {extra && <div className="mt-2">{extra}</div>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={onConfirm}
                disabled={busy}
                className={`${styles.confirm} text-xs font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {confirmLabel}
              </button>
              <button
                onClick={onCancel}
                disabled={busy}
                className={`${styles.cancel} text-xs font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
