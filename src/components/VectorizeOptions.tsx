import type { VectorizeMode, VectorizeTuning } from "../lib/types";

interface VectorizeOptionsProps {
  mode: VectorizeMode;
  tuning: VectorizeTuning;
  onModeChange: (mode: VectorizeMode) => void;
  onTuningChange: (tuning: VectorizeTuning) => void;
}

export function VectorizeOptions({
  mode,
  tuning,
  onModeChange,
  onTuningChange,
}: VectorizeOptionsProps) {
  return (
    <div className="settings-card">
      <h3>ベクター化オプション</h3>
      <div className="radio-group">
        <button
          type="button"
          className={`radio-row ${mode === "color" ? "is-selected" : ""}`}
          onClick={() => onModeChange("color")}
        >
          <span className="radio-row-dot" aria-hidden />
          <span className="radio-row-label">Color</span>
          <span className="radio-row-hint">vtracer color</span>
        </button>
        <button
          type="button"
          className={`radio-row ${mode === "bw" ? "is-selected" : ""}`}
          onClick={() => onModeChange("bw")}
        >
          <span className="radio-row-dot" aria-hidden />
          <span className="radio-row-label">Monochrome</span>
          <span className="radio-row-hint">vtracer bw</span>
        </button>
      </div>

      <div className="section-divider" />

      <div className="field">
        <div className="field-row">
          <span className="field-label">Color precision</span>
          <span className="field-value">{tuning.colorPrecision} bit</span>
        </div>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={tuning.colorPrecision}
          onChange={(e) =>
            onTuningChange({ ...tuning, colorPrecision: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Filter speckle</span>
          <span className="field-value">{tuning.filterSpeckle} px</span>
        </div>
        <input
          type="range"
          min={0}
          max={32}
          step={1}
          value={tuning.filterSpeckle}
          onChange={(e) =>
            onTuningChange({ ...tuning, filterSpeckle: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Corner threshold</span>
          <span className="field-value">{tuning.cornerThreshold}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={180}
          step={1}
          value={tuning.cornerThreshold}
          onChange={(e) =>
            onTuningChange({ ...tuning, cornerThreshold: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Segment length</span>
          <span className="field-value">{tuning.segmentLength.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={tuning.segmentLength}
          onChange={(e) =>
            onTuningChange({ ...tuning, segmentLength: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Splice threshold</span>
          <span className="field-value">{tuning.spliceThreshold}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={180}
          step={1}
          value={tuning.spliceThreshold}
          onChange={(e) =>
            onTuningChange({ ...tuning, spliceThreshold: Number(e.currentTarget.value) })
          }
        />
      </div>
    </div>
  );
}
