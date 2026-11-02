import { Icon } from './Icon';

export function Stepper({ value, onChange, min = -Infinity, max = Infinity, label, height = 44 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; height?: number;
}) {
  return (
    <div className="gr-stepper" style={{ height }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Lower ${label}`} disabled={value <= min}>
        <Icon name="minus" />
      </button>
      <output aria-label={label}>{value}</output>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Raise ${label}`} disabled={value >= max}>
        <Icon name="plus" />
      </button>
    </div>
  );
}
