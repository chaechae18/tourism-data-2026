import { RotateCw } from "lucide-react";
import AppButton from "../ui/AppButton";

/**
 * Loading / error / empty states for a home section.
 *
 * Wraps the section's real markup as `children` and renders it only once there
 * is something to show. Nothing here invents content: a failed request says so
 * rather than showing placeholder copy that looks like a working screen.
 */
export default function SectionStatus({ loading, error, empty, emptyLabel, onRetry, skeleton, children }) {
  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-3">
        <span className="sr-only">불러오는 중</span>
        {skeleton}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-dashed border-[#e0c9b4] bg-[#fffaf3] p-5 text-center">
        <p className="text-sm font-bold text-[#8f4515]">불러오지 못했어요</p>
        <p className="mt-1 text-sm text-[#6f6256]">{error.message}</p>
        {onRetry && (
          <AppButton className="mt-4" icon={RotateCw} onClick={onRetry} size="sm" variant="outline">
            다시 시도
          </AppButton>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <p className="rounded-lg border border-dashed border-[#e6ddd2] px-4 py-6 text-center text-sm text-[#8a7d71]">
        {emptyLabel}
      </p>
    );
  }

  return children ?? null;
}

export function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-[#ece4da] ${className}`} />;
}
