export default function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] p-4">
      {Icon && (
        <div className="mb-2">
          <Icon size={18} className="text-[var(--brand-ink)]" />
        </div>
      )}
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-display text-[26px] leading-none mt-1.5 text-[var(--brand-ink)]">{value}</p>
    </div>
  );
}
