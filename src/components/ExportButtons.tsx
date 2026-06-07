import type { PngVariant } from "../lib/pngExport";

interface ExportButtonsProps {
  hasSvg: boolean;
  pngVariants: PngVariant[];
  isBusy: boolean;
  onSaveSvg: (kind: "original" | "black" | "white") => void;
  onSavePng: (variant: PngVariant) => void;
}

export function ExportButtons({
  hasSvg,
  pngVariants,
  isBusy,
  onSaveSvg,
  onSavePng,
}: ExportButtonsProps) {
  return (
    <div className="export-bar">
      <span className="export-bar-label">書き出し</span>

      <button
        className="button button-secondary"
        disabled={!hasSvg || isBusy}
        onClick={() => onSaveSvg("original")}
      >
        SVG (元色)
      </button>
      <button
        className="button button-secondary"
        disabled={!hasSvg || isBusy}
        onClick={() => onSaveSvg("black")}
      >
        SVG (黒)
      </button>
      <button
        className="button button-secondary"
        disabled={!hasSvg || isBusy}
        onClick={() => onSaveSvg("white")}
      >
        SVG (白)
      </button>

      <div className="export-bar-divider" />

      {pngVariants.length === 0 && (
        <span className="dim" style={{ fontSize: "var(--text-sm)" }}>
          PNG 派生は「Convert」を押すと利用可能
        </span>
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
    </div>
  );
}
