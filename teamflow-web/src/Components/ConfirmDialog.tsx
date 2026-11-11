import Dialog from "./Dialog";

interface ConfirmDialogProps {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      size="sm"
      eyebrow="Please confirm"
      title={title}
      onClose={onCancel}
      locked={busy}
      footer={
        <>
          <button type="button" className="dlg-btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`dlg-btn ${danger ? "dlg-btn-danger" : "dlg-btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="cd-message">{message}</p>
    </Dialog>
  );
}