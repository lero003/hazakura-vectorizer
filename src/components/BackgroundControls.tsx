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
      <h3>背景処理</h3>
      <div className="radio-group">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
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
          <span className="field-label">White threshold</span>
          <span className="field-value">{settings.whiteThreshold}</span>
        </div>
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={settings.whiteThreshold}
          disabled={!removeWhiteActive}
          onChange={(e) =>
            onSettingsChange({ ...settings, whiteThreshold: Number(e.currentTarget.value) })
          }
        />
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Edge softness</span>
          <span className="field-value">{settings.edgeSoftness}</span>
        </div>
        <input
          type="range"
          min={0}
          max={64}
          step={1}
          value={settings.edgeSoftness}
          disabled={!removeWhiteActive}
          onChange={(e) =>
            onSettingsChange({ ...settings, edgeSoftness: Number(e.currentTarget.value) })
          }
        />
      </div>

      <button
        type="button"
        className={`toggle ${settings.removeFringe ? "is-on" : ""}`}
        disabled={!removeWhiteActive}
        onClick={() =>
          onSettingsChange({ ...settings, removeFringe: !settings.removeFringe })
        }
        style={removeWhiteActive ? undefined : { opacity: 0.4 }}
      >
        <span className="toggle-track">
          <span className="toggle-knob" />
        </span>
        <span className="toggle-label">Remove fringe</span>
      </button>
    </div>
  );
}
