import type { PngVariant } from "../lib/pngExport";
import type { VectorizeMode, VectorizeModeSet, VectorizeResult } from "../lib/types";

interface ExportButtonsProps {
  hasSvg: boolean;
  /** Modes the user requested at Convert time. We only render SVG groups
   *  for modes that actually have a result in `svgResults`. */
  modes: VectorizeModeSet;
  /** Mode → vectorize result. Single-mode renders one group; multi-mode
   *  renders one group per mode that has a result, in the order of `modes`. */
  svgResults: ReadonlyMap<VectorizeMode, VectorizeResult>;
  pngVariants: PngVariant[];
  isBusy: boolean;
  onSaveSvg: (
    mode: VectorizeMode,
    kind: "original" | "black" | "white",
  ) => void;
  onSavePng: (variant: PngVariant) => void;
  /** One-shot save for every available format. Triggered by the primary
   *  "Save all" button. */
  onSaveAll: () => void;
}

const SVG_KINDS: { kind: "original" | "black" | "white"; label: string }[] = [
  { kind: "original", label: "SVG (元色)" },
  { kind: "black", label: "SVG (黒)" },
  { kind: "white", label: "SVG (白)" },
];

function modeLabel(mode: VectorizeMode): string {
  return mode === "color" ? "Color" : "Monochrome";
}

export function ExportButtons({
  hasSvg,
  modes,
  svgResults,
  pngVariants,
  isBusy,
  onSaveSvg,
  onSavePng,
  onSaveAll,
}: ExportButtonsProps) {
  // Only show mode groups that actually produced a result. Skip empty
  // buckets so the export bar doesn't render dead buttons after a partial
  // failure.
  const modeGroups = modes.filter((m) => svgResults.has(m));
  const isMulti = modeGroups.length > 1;
  const canSaveAll = hasSvg && pngVariants.length > 0 && !isBusy;

  return (
    <div className="export-bar">
      <button
        className="button button-primary export-bar-save-all"
        disabled={!canSaveAll}
        onClick={onSaveAll}
        aria-label="全形式を書き出す (Color/Monochrome 両方 + 透過 PNG + 白背景 PNG + 512px + 1024px)"
        title="フォルダを 1 つ選べば、SVG バリアントと PNG 派生を全部まとめて保存します"
      >
        <span className="export-bar-save-all-icon" aria-hidden>
          ⤓
        </span>
        全形式を書き出す
        {canSaveAll && (
          <span className="export-bar-save-all-count">
            {modeGroups.length * 3 + pngVariants.length} ファイル
          </span>
        )}
      </button>

      {modeGroups.length === 0 && pngVariants.length === 0 ? (
        <span className="dim" style={{ fontSize: "var(--text-sm)" }}>
          「Convert」を押すと保存ボタンが利用可能
        </span>
      ) : (
        <>
          {modeGroups.map((mode, idx) => (
            <div key={mode} className="export-bar-mode-group">
              {idx > 0 && <div className="export-bar-divider" />}
              {SVG_KINDS.map(({ kind, label }) => (
                <button
                  key={`${mode}-${kind}`}
                  className="button button-secondary"
                  disabled={isBusy}
                  onClick={() => onSaveSvg(mode, kind)}
                >
                  {isMulti ? `${modeLabel(mode)} ${label}` : label}
                </button>
              ))}
            </div>
          ))}

          {pngVariants.length > 0 && modeGroups.length > 0 && (
            <div className="export-bar-divider" />
          )}

          {pngVariants.map((v) => (
            <button
              key={v.key}
              className="button button-secondary"
              disabled={isBusy}
              onClick={() => onSavePng(v)}
            >
              {v.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
