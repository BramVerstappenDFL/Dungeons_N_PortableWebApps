interface Props { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }
export function Stepper({ value, onChange, min = -Infinity, max = Infinity, label }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Decrease ${label ?? ''}`}>−</button>
      <input type="number" inputMode="numeric" value={value} onChange={(e) => set(Number(e.target.value) || 0)} aria-label={label} />
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max} aria-label={`Increase ${label ?? ''}`}>+</button>
    </div>
  );
}
