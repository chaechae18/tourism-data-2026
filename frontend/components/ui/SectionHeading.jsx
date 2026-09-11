export default function SectionHeading({ eyebrow, title, action, className = "mb-5" }) {
  return (
    <div className={`${className} flex items-end justify-between gap-4`}>
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold text-[#343235]">{title}</h1>
      </div>
      {action}
    </div>
  );
}
