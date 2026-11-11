import { useEffect, useId, type ReactNode } from "react";
import "./Dialog.css";

interface DialogProps {
  readonly title: string;
  readonly eyebrow?: string;
  readonly onClose: () => void;
  // When true, Escape and backdrop clicks are ignored (for example while saving). 
  readonly locked?: boolean;
  readonly size?: "sm" | "md" | "lg";
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

// Accessible modal with a plain backdrop. No native dialog frame or outline. 
export default function Dialog({
  title,
  eyebrow,
  onClose,
  locked = false,
  size = "md",
  children,
  footer,
}: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, locked]);

  return (
    <div className="dlg-backdrop">
      <dialog open className={`dlg dlg-${size}`} aria-modal="true" aria-labelledby={titleId}>
        <header className="dlg-head">
          <div>
            {eyebrow && <p className="dlg-eyebrow">{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="dlg-close" onClick={onClose} disabled={locked} aria-label="Close">
            x
          </button>
        </header>

        <div className="dlg-body">{children}</div>

        {footer && <footer className="dlg-foot">{footer}</footer>}
      </dialog>
    </div>
  );
}