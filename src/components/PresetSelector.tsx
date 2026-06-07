import { PRESETS } from "../lib/presets";
import type { CurvePreset } from "../lib/types";

interface PresetSelectorProps {
  value: CurvePreset;
  onChange: (id: CurvePreset) => void;
}

export function PresetSelector({ value, onChange }: PresetSelectorProps) {
  return (
    <div className="settings-card">
      <h3 id="preset-title">プリセット</h3>
      <div
        className="preset-grid"
        role="radiogroup"
        aria-labelledby="preset-title"
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={value === preset.id}
            className={`preset-card ${value === preset.id ? "is-selected" : ""}`}
            onClick={() => onChange(preset.id)}
          >
            <span className="preset-card-label">{preset.label}</span>
            <span className="preset-card-desc">{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
