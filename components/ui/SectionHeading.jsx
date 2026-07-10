export default function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a4e17]">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold text-[#241b16]">{title}</h1>
      </div>
      {action}
    </div>
  );
}
