export default function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] p-4">
      {Icon && <Icon size={18} className="text-[var(--gold-deep)] mb-2" aria-hidden="true" />}
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="serif text-[28px] leading-none mt-1.5 text-[var(--navy)]">{value}</p>
    </div>
  );
}
