import { useCallback, useState } from "react";
import { validateImageFile, isAcceptedFile } from "../lib/imageLoad";

interface DropZoneProps {
  onFile: (file: File) => void;
  compact?: boolean;
  currentFileName?: string;
  onError: (message: string) => void;
}

export function DropZone({ onFile, compact = false, currentFileName, onError }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!isAcceptedFile(file)) {
        onError("対応していない形式です。PNG / JPG / WebP を指定してください。");
        return;
      }
      const validationError = validateImageFile(file);
      if (validationError) {
        onError(validationError);
        return;
      }
      onFile(file);
    },
    [onFile, onError],
  );

  return (
    <label
      className={`drop-zone ${compact ? "drop-zone-compact" : ""} ${isDragOver ? "is-dragover" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.currentTarget.files)}
      />
      <div className="drop-zone-icon" aria-hidden>↓</div>
      <div>
        <div className="drop-zone-title">
          {currentFileName ? `現在: ${currentFileName}` : "画像をドロップ"}
        </div>
        <div className="drop-zone-hint">
          {compact
            ? "クリックで別の画像を選択 / PNG · JPG · WebP"
            : "クリックして選択 または ここにドロップ / PNG · JPG · WebP"}
        </div>
      </div>
    </label>
  );
}
