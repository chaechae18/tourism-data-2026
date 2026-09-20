import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "../i18n/LanguageProvider";
import { IconButton } from "./AppButton";

export default function AppModal({ children, onClose, open, title, variant = "sheet" }) {
  const { t } = useI18n();
  const panel = useRef(null);
  const centered = variant === "dialog";

  useEffect(() => {
    if (!open || !centered) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, centered]);

  const handleKeyDown = (event) => {
    if (!centered) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
    if (event.key !== "Tab") return;
    const buttons = panel.current.querySelectorAll("button:not(:disabled)");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const modal = (
    <div className={`fixed inset-0 z-50 flex justify-center bg-[#343235]/45 ${centered ? "items-center p-5" : "items-end"}`}
      onClick={centered ? (event) => { if (event.target === event.currentTarget) onClose(); } : undefined}>
      <section ref={panel} className={`${centered ? "max-h-[80dvh] max-w-[380px] overscroll-contain rounded-2xl" : "app-modal-sheet h-[100svh] max-w-[430px]"} w-full overflow-y-auto bg-white px-6 py-7 shadow-2xl`} aria-modal="true" role="dialog" aria-label={title} onKeyDown={handleKeyDown}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-[#343235]">{title}</h2>
          <IconButton icon={X} label={t("common.close")} onClick={onClose} />
        </div>
        {children}
      </section>
    </div>
  );
  return centered ? createPortal(modal, document.body) : modal;
}
