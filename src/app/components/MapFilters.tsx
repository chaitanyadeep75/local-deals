type Props = {
  distance: number;
  setDistance: (v: number) => void;
  boostedOnly: boolean;
  setBoostedOnly: (v: boolean) => void;
};

export default function MapFilters({
  distance,
  setDistance,
  boostedOnly,
  setBoostedOnly,
}: Props) {
  return (
    <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-card backdrop-blur-xl">
      <select
        value={distance}
        onChange={(e) => setDistance(Number(e.target.value))}
        className="rounded-xl border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
      >
        <option value={1}>1 km</option>
        <option value={3}>3 km</option>
        <option value={5}>5 km</option>
        <option value={10}>10 km</option>
      </select>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={boostedOnly}
          onChange={(e) => setBoostedOnly(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-slate-800/80 text-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/40"
        />
        Boosted only
      </label>
    </div>
  );
}
