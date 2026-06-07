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
      <h3 id="vec-opts-title">ベクター化オプション</h3>
      <div
        className="radio-group"
        role="radiogroup"
        aria-labelledby="vec-opts-title"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "color"}
          className={`radio-row ${mode === "color" ? "is-selected" : ""}`}
          onClick={() => onModeChange("color")}
        >
          <span className="radio-row-dot" aria-hidden />
          <span className="radio-row-label">Color</span>
          <span className="radio-row-hint">vtracer color</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "bw"}
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
