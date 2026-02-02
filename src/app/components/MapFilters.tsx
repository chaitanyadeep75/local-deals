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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg px-4 py-3 flex gap-4 items-center z-10">
      <select
        value={distance}
        onChange={(e) => setDistance(Number(e.target.value))}
        className="border rounded px-2 py-1 text-sm"
      >
        <option value={1}>1 km</option>
        <option value={3}>3 km</option>
        <option value={5}>5 km</option>
        <option value={10}>10 km</option>
      </select>

      <label className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          checked={boostedOnly}
          onChange={(e) => setBoostedOnly(e.target.checked)}
        />
        Boosted only
      </label>
    </div>
  );
}
