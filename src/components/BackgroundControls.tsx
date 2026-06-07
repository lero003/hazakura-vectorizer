import type { BackgroundMode, CutoutSettings } from "../lib/types";

interface BackgroundControlsProps {
  mode: BackgroundMode;
  settings: CutoutSettings;
  onModeChange: (mode: BackgroundMode) => void;
  onSettingsChange: (settings: CutoutSettings) => void;
}

const MODES: { value: BackgroundMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "画像を判定して自動選択" },
  { value: "keep-transparent", label: "Keep Transparent", hint: "既存の α を維持" },
  { value: "remove-white", label: "Remove White", hint: "白背景を透明化" },
  { value: "white-background", label: "White Background", hint: "白背景として出力" },
];

export function BackgroundControls({
  mode,
  settings,
  onModeChange,
  onSettingsChange,
}: BackgroundControlsProps) {
  const removeWhiteActive = mode === "remove-white" || mode === "auto";
  return (
    <div className="settings-card">
      <h3 id="bg-controls-title">背景処理</h3>
      <div
        className="radio-group"
        role="radiogroup"
        aria-labelledby="bg-controls-title"
      >
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            className={`radio-row ${mode === m.value ? "is-selected" : ""}`}
            onClick={() => onModeChange(m.value)}
          >
            <span className="radio-row-dot" aria-hidden />
            <span className="radio-row-label">{m.label}</span>
            <span className="radio-row-hint">{m.hint}</span>
          </button>
        ))}
      </div>

      <div className="section-divider" />

      <div className="field">
        <div className="field-row">
          <label
            className="field-label"
            htmlFor="bg-white-threshold"
          >
            White threshold
          </label>
          <span className="field-value" aria-hidden>
            {settings.whiteThreshold}
          </span>
        </div>
        <input
          id="bg-white-threshold"
          type="range"
          min={0}
          max={120}
          step={1}
          value={settings.whiteThreshold}
          disabled={!removeWhiteActive}
          aria-label="White threshold (0–120)"
          aria-valuetext={`${settings.whiteThreshold} of 120`}
          onChange={(e) =>
            onSettingsChange({ ...settings, whiteThreshold: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label
            className="field-label"
            htmlFor="bg-edge-softness"
          >
            Edge softness
          </label>
          <span className="field-value" aria-hidden>
            {settings.edgeSoftness}
          </span>
        </div>
        <input
          id="bg-edge-softness"
          type="range"
          min={0}
          max={64}
          step={1}
          value={settings.edgeSoftness}
          disabled={!removeWhiteActive}
          aria-label="Edge softness (0–64)"
          aria-valuetext={`${settings.edgeSoftness} of 64`}
          onChange={(e) =>
            onSettingsChange({ ...settings, edgeSoftness: Number(e.currentTarget.value) })
          }
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={settings.removeFringe}
        aria-label="Remove fringe (definge white halo)"
        className={`toggle ${settings.removeFringe ? "is-on" : ""}`}
        disabled={!removeWhiteActive}
        onClick={() =>
          onSettingsChange({ ...settings, removeFringe: !settings.removeFringe })
        }
        style={removeWhiteActive ? undefined : { opacity: 0.4 }}
      >
        <span className="toggle-track" aria-hidden>
          <span className="toggle-knob" />
        </span>
        <span className="toggle-label">Remove fringe</span>
      </button>
    </div>
  );
}
