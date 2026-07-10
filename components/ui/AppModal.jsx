import { X } from "lucide-react";
import { IconButton } from "./AppButton";

export default function AppModal({ children, onClose, open, title }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#343235]/45 p-4 sm:items-center sm:justify-center">
      <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" aria-modal="true" role="dialog" aria-label={title}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-[#343235]">{title}</h2>
          <IconButton icon={X} label="닫기" onClick={onClose} />
        </div>
        {children}
      </section>
    </div>
  );
}
