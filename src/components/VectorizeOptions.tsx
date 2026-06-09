import type {
  VectorizeMode,
  VectorizeModeSet,
  VectorizeTuning,
} from "../lib/types";

interface VectorizeOptionsProps {
  modes: VectorizeModeSet;
  /** Active mode used by the SVG preview and the single-file Save buttons.
   * Always one of `modes`. Required because preview/export UI needs a
   * "currently focused" mode even when multiple are produced. */
  activeMode: VectorizeMode;
  tuning: VectorizeTuning;
  onModesChange: (modes: VectorizeModeSet) => void;
  onTuningChange: (tuning: VectorizeTuning) => void;
}

const MODE_DEFS: { value: VectorizeMode; label: string; hint: string }[] = [
  { value: "color", label: "Color", hint: "vtracer color" },
  { value: "bw", label: "Monochrome", hint: "vtracer bw" },
];

function toggleMode(
  modes: VectorizeModeSet,
  target: VectorizeMode,
): VectorizeModeSet {
  if (modes.includes(target)) {
    if (modes.length === 1) return modes; // never empty
    return modes.filter((m) => m !== target);
  }
  // Always keep a stable order: color first, then bw.
  const next = new Set(modes);
  next.add(target);
  return (["color", "bw"] as VectorizeMode[]).filter((m) => next.has(m));
}

export function VectorizeOptions({
  modes,
  tuning,
  onModesChange,
  onTuningChange,
}: VectorizeOptionsProps) {
  const isMulti = modes.length > 1;
  return (
    <div className="settings-card">
      <h3 id="vec-opts-title">ベクター化オプション</h3>
      <div
        className="checkbox-group"
        role="group"
        aria-labelledby="vec-opts-title"
      >
        {MODE_DEFS.map((m) => {
          const checked = modes.includes(m.value);
          return (
            <button
              key={m.value}
              type="button"
              role="checkbox"
              aria-checked={checked}
              className={`checkbox-row ${checked ? "is-selected" : ""}`}
              onClick={() => onModesChange(toggleMode(modes, m.value))}
            >
              <span className="checkbox-row-box" aria-hidden>
                {checked ? "✓" : ""}
              </span>
              <span className="checkbox-row-label">{m.label}</span>
              <span className="checkbox-row-hint">{m.hint}</span>
            </button>
          );
        })}
      </div>
      {isMulti && (
        <p className="dim" style={{ fontSize: "var(--text-xs)", margin: 0 }}>
          Convert 1 回で {modes.length} 形式を並列生成します。プレビューと
          書き出しは下の「表示」切替で選べます。
        </p>
      )}

      <div className="section-divider" />

      <div className="field">
        <div className="field-row">
          <label className="field-label" htmlFor="vec-color-precision">
            Color precision
          </label>
          <span className="field-value" aria-hidden>
            {tuning.colorPrecision} bit
          </span>
        </div>
        <input
          id="vec-color-precision"
          type="range"
          min={1}
          max={8}
          step={1}
          value={tuning.colorPrecision}
          aria-label="Color precision (1–8 bits)"
          aria-valuetext={`${tuning.colorPrecision} bit`}
          onChange={(e) =>
            onTuningChange({ ...tuning, colorPrecision: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label className="field-label" htmlFor="vec-filter-speckle">
            Filter speckle
          </label>
          <span className="field-value" aria-hidden>
            {tuning.filterSpeckle} px
          </span>
        </div>
        <input
          id="vec-filter-speckle"
          type="range"
          min={0}
          max={32}
          step={1}
          value={tuning.filterSpeckle}
          aria-label="Filter speckle (0–32 pixels)"
          aria-valuetext={`${tuning.filterSpeckle} pixels`}
          onChange={(e) =>
            onTuningChange({ ...tuning, filterSpeckle: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label className="field-label" htmlFor="vec-corner-threshold">
            Corner threshold
          </label>
          <span className="field-value" aria-hidden>
            {tuning.cornerThreshold}°
          </span>
        </div>
        <input
          id="vec-corner-threshold"
          type="range"
          min={0}
          max={180}
          step={1}
          value={tuning.cornerThreshold}
          aria-label="Corner threshold (0–180 degrees)"
          aria-valuetext={`${tuning.cornerThreshold} degrees`}
          onChange={(e) =>
            onTuningChange({ ...tuning, cornerThreshold: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label className="field-label" htmlFor="vec-segment-length">
            Segment length
          </label>
          <span className="field-value" aria-hidden>
            {tuning.segmentLength.toFixed(1)}
          </span>
        </div>
        <input
          id="vec-segment-length"
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={tuning.segmentLength}
          aria-label="Segment length (1–20)"
          aria-valuetext={tuning.segmentLength.toFixed(1)}
          onChange={(e) =>
            onTuningChange({ ...tuning, segmentLength: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label className="field-label" htmlFor="vec-splice-threshold">
            Splice threshold
          </label>
          <span className="field-value" aria-hidden>
            {tuning.spliceThreshold}°
          </span>
        </div>
        <input
          id="vec-splice-threshold"
          type="range"
          min={0}
          max={180}
          step={1}
          value={tuning.spliceThreshold}
          aria-label="Splice threshold (0–180 degrees)"
          aria-valuetext={`${tuning.spliceThreshold} degrees`}
          onChange={(e) =>
            onTuningChange({ ...tuning, spliceThreshold: Number(e.currentTarget.value) })
          }
        />
      </div>
    </div>
  );
}
