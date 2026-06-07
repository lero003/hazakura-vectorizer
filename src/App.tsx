import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { DropZone } from "./components/DropZone";
import { PreviewPane } from "./components/PreviewPane";
import { PresetSelector } from "./components/PresetSelector";
import { BackgroundControls } from "./components/BackgroundControls";
import { VectorizeOptions } from "./components/VectorizeOptions";
import { ExportButtons } from "./components/ExportButtons";
import { ToastStack } from "./components/Toast";
import { ThemeToggle } from "./components/ThemeToggle";

import {
  applyCutoutAsync,
  CutoutCancelledError,
  estimateBackgroundColor,
  type CutoutResult,
} from "./lib/cutout";
import {
  disposeImage,
  isAcceptedFile,
  loadImage,
  validateImageFile,
} from "./lib/imageLoad";
import {
  generatePngVariants,
  type PngVariant,
} from "./lib/pngExport";
import {
  blackVariant,
  ensureViewBox,
  stripMetadata,
  whiteVariant,
} from "./lib/svgVariants";
import { findPreset } from "./lib/presets";
import {
  bytesToBase64,
  readImageFile,
  saveDialogAndWrite,
  vectorizeImage,
} from "./lib/tauriInvoke";
import type {
  BackgroundMode,
  CurvePreset,
  CutoutSettings,
  LoadedImage,
  ThemeName,
  ToastKind,
  ToastMessage,
  VectorizeResult,
  VectorizeTuning,
} from "./lib/types";

const THEME_STORAGE_KEY = "hazakura-vectorizer:theme";
const CUTOUT_DEBOUNCE_MS = 150;
const MIN_BG_REQUIRED_MODES: ReadonlySet<BackgroundMode> = new Set([
  "auto",
  "remove-white",
]);

const initialPreset = findPreset("logo")!;

const initialCutout: CutoutSettings = {
  mode: initialPreset.backgroundMode,
  whiteThreshold: initialPreset.whiteThreshold,
  edgeSoftness: initialPreset.edgeSoftness,
  removeFringe: initialPreset.removeFringe,
};

const initialTuning: VectorizeTuning = {
  colorPrecision: initialPreset.colorPrecision,
  filterSpeckle: initialPreset.filterSpeckle,
  cornerThreshold: initialPreset.cornerThreshold,
  segmentLength: initialPreset.segmentLength,
  spliceThreshold: initialPreset.spliceThreshold,
};

function makeToast(kind: ToastKind, text: string, detail?: string): ToastMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    text,
    detail,
  };
}

function inferMimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [background, setBackground] = useState<[number, number, number] | null>(null);
  const [preset, setPreset] = useState<CurvePreset>(initialPreset.id);
  const [cutoutSettings, setCutoutSettings] =
    useState<CutoutSettings>(initialCutout);
  const [vectorizeTuning, setVectorizeTuning] =
    useState<VectorizeTuning>(initialTuning);
  const [vectorizeMode, setVectorizeMode] = useState<"color" | "bw">(
    initialPreset.mode,
  );
  const [cutoutResult, setCutoutResult] = useState<CutoutResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [vectorizeResult, setVectorizeResult] =
    useState<VectorizeResult | null>(null);
  const [pngVariants, setPngVariants] = useState<PngVariant[]>([]);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const cutoutJobRef = useRef(0);
  const cutoutCacheRef = useRef<{
    key: string;
    result: CutoutResult;
  } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const pushToast = useCallback((toast: ToastMessage) => {
    setToasts((current) => [...current, toast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const handleError = useCallback(
    (message: string, detail?: string) => {
      pushToast(makeToast("error", message, detail));
    },
    [pushToast],
  );

  const ingestFile = useCallback(
    async (file: File) => {
      const validationError = validateImageFile(file);
      if (validationError) {
        handleError(validationError);
        return;
      }
      try {
        const next = await loadImage(file);
        setImage((prev) => {
          if (prev) disposeImage(prev);
          return next;
        });
        setVectorizeResult(null);
        setPngVariants([]);
        setBackground(null);
        setCutoutResult(null);
        cutoutCacheRef.current = null;
        pushToast(
          makeToast(
            "success",
            "画像を読み込みました",
            `${next.naturalWidth}×${next.naturalHeight}`,
          ),
        );
      } catch (err) {
        handleError(
          "画像の読み込みに失敗しました",
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [handleError, pushToast],
  );

  const handleFile = useCallback(
    async (file: File) => {
      await ingestFile(file);
    },
    [ingestFile],
  );

  const handlePath = useCallback(
    async (path: string) => {
      try {
        const bytes = await readImageFile(path);
        const fileName = path.split("/").pop() || "image";
        const mime = inferMimeFromPath(path);
        const file = new File([new Uint8Array(bytes)], fileName, { type: mime });
        if (!isAcceptedFile(file)) {
          handleError("対応していない形式です。PNG / JPG / WebP を指定してください。");
          return;
        }
        await ingestFile(file);
      } catch (err) {
        handleError(
          "ドロップされたファイルを読み込めませんでした",
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [ingestFile, handleError],
  );

  // Tauri D&D listener
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (cancelled) return;
          const payload = event.payload;
          if (payload.type === "drop" && payload.paths.length > 0) {
            const first = payload.paths[0]!;
            handlePath(first);
          }
        });
      } catch {
        // Not in Tauri context (e.g. Vite dev) — ignore.
      }
    })();
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [handlePath]);

  const handlePresetChange = useCallback((id: CurvePreset) => {
    setPreset(id);
    const p = findPreset(id);
    if (!p) return;
    setCutoutSettings({
      mode: p.backgroundMode,
      whiteThreshold: p.whiteThreshold,
      edgeSoftness: p.edgeSoftness,
      removeFringe: p.removeFringe,
    });
    setVectorizeTuning({
      colorPrecision: p.colorPrecision,
      filterSpeckle: p.filterSpeckle,
      cornerThreshold: p.cornerThreshold,
      segmentLength: p.segmentLength,
      spliceThreshold: p.spliceThreshold,
    });
    setVectorizeMode(p.mode);
  }, []);

  // Background estimation effect — runs once per image, stores in separate state
  useEffect(() => {
    if (!image) {
      setBackground(null);
      return;
    }
    setBackground(null);
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const bg = estimateBackgroundColor(image.bitmap);
        if (cancelled) return;
        setBackground(bg);
      } catch {
        /* ignore estimation errors */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  // Cutout effect — debounced, cancellable, does NOT update image state
  useEffect(() => {
    if (!image) {
      setCutoutResult(null);
      return;
    }

    if (
      MIN_BG_REQUIRED_MODES.has(cutoutSettings.mode) &&
      background === null
    ) {
      return;
    }

    const cacheKey = JSON.stringify({
      mode: cutoutSettings.mode,
      background,
      threshold: cutoutSettings.whiteThreshold,
      softness: cutoutSettings.edgeSoftness,
      fringe: cutoutSettings.removeFringe,
    });
    if (cutoutCacheRef.current?.key === cacheKey) {
      setCutoutResult(cutoutCacheRef.current.result);
      return;
    }

    const jobId = ++cutoutJobRef.current;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || cutoutJobRef.current !== jobId) return;
      setIsComputing(true);
      try {
        const result = await applyCutoutAsync({
          bitmap: image.bitmap,
          background,
          settings: cutoutSettings,
          isCancelled: () => cutoutJobRef.current !== jobId,
        });
        if (cancelled || cutoutJobRef.current !== jobId) return;
        cutoutCacheRef.current = { key: cacheKey, result };
        setCutoutResult(result);
      } catch (err) {
        if (err instanceof CutoutCancelledError) return;
        if (cancelled || cutoutJobRef.current !== jobId) return;
        handleError(
          "背景処理でエラー",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        if (cutoutJobRef.current === jobId) {
          setIsComputing(false);
        }
      }
    }, CUTOUT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, cutoutSettings, background, handleError]);

  // Reset PNG variants when image or cutout result changes
  useEffect(() => {
    setPngVariants([]);
  }, [image, cutoutResult]);

  const handleConvert = useCallback(async () => {
    if (!image) return;
    setIsVectorizing(true);
    setPngVariants([]);
    setVectorizeResult(null);
    try {
      const bytes = new Uint8Array(await image.file.arrayBuffer());
      const result = await vectorizeImage(bytes, {
        mode: vectorizeMode,
        colorPrecision: vectorizeTuning.colorPrecision,
        cornerThreshold: vectorizeTuning.cornerThreshold,
        filterSpeckle: vectorizeTuning.filterSpeckle,
        segmentLength: vectorizeTuning.segmentLength,
        spliceThreshold: vectorizeTuning.spliceThreshold,
      });
      setVectorizeResult({
        ...result,
        svg: ensureViewBox(stripMetadata(result.svg)),
      });
      pushToast(
        makeToast(
          "success",
          "SVG 変換完了",
          `${result.pathCount} paths / ${result.width}×${result.height}`,
        ),
      );

      if (cutoutResult) {
        setIsGeneratingPng(true);
        try {
          const variants = await generatePngVariants({
            cutout: cutoutResult,
            baseName: image.file.name,
            includeTransparent: true,
            includeWhiteBackground: true,
            png512: true,
            png1024: true,
          });
          setPngVariants(variants);
          pushToast(makeToast("success", "PNG 派生を生成しました"));
        } catch (err) {
          handleError(
            "PNG 派生生成に失敗",
            err instanceof Error ? err.message : String(err),
          );
        } finally {
          setIsGeneratingPng(false);
        }
      }
    } catch (err) {
      handleError(
        "変換に失敗しました",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setIsVectorizing(false);
    }
  }, [
    image,
    vectorizeMode,
    vectorizeTuning,
    cutoutResult,
    pushToast,
    handleError,
  ]);

  const baseName = useMemo(() => {
    if (!image) return "asset";
    return image.file.name.replace(/\.[^.]+$/, "");
  }, [image]);

  const handleSaveSvg = useCallback(
    async (kind: "original" | "black" | "white") => {
      if (!vectorizeResult) return;
      setIsSaving(true);
      try {
        let svg = vectorizeResult.svg;
        if (kind === "black") svg = blackVariant(svg);
        if (kind === "white") svg = whiteVariant(svg);
        const filename = `${baseName}-${kind}.svg`;
        const savedPath = await saveDialogAndWrite({
          contentsBase64: bytesToBase64(new TextEncoder().encode(svg)),
          suggestedFilename: filename,
          fileKind: "svg",
          title: `${kind} SVG を保存`,
        });
        if (savedPath) {
          pushToast(makeToast("success", "SVG を保存しました", savedPath));
        }
      } catch (err) {
        handleError(
          "SVG 保存に失敗",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [vectorizeResult, baseName, pushToast, handleError],
  );

  const handleSavePng = useCallback(
    async (variant: PngVariant) => {
      setIsSaving(true);
      try {
        const bytes = new Uint8Array(await variant.blob.arrayBuffer());
        const filename = `${baseName}-${variant.filenameSuffix}.png`;
        const savedPath = await saveDialogAndWrite({
          contentsBase64: bytesToBase64(bytes),
          suggestedFilename: filename,
          fileKind: "png",
          title: `${variant.label} を保存`,
        });
        if (savedPath) {
          pushToast(makeToast("success", `${variant.label} を保存しました`, savedPath));
        }
      } catch (err) {
        handleError(
          "PNG 保存に失敗",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [baseName, pushToast, handleError],
  );

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const status = useMemo(() => {
    if (isVectorizing) {
      return { label: "Vectorizing…", working: true };
    }
    if (isGeneratingPng) {
      return { label: "Generating PNG variants…", working: true };
    }
    if (isSaving) {
      return { label: "Saving…", working: true };
    }
    if (isComputing) {
      return { label: "Computing cutout…", working: true };
    }
    if (vectorizeResult) {
      return {
        label: "Ready",
        working: false,
        detail: `${vectorizeResult.pathCount} paths`,
      };
    }
    if (image) {
      return { label: "Image loaded", working: false };
    }
    return { label: "Drop an image to start", working: false };
  }, [
    isVectorizing,
    isGeneratingPng,
    isSaving,
    isComputing,
    vectorizeResult,
    image,
  ]);

  const showEmpty = !image;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-mark" aria-hidden />
          <span>Hazakura Vectorizer</span>
          <small>v0.1 · local</small>
        </div>
        <div className="app-header-actions">
          <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
        </div>
      </header>

      <main className="app-main">
        <aside className="app-sidebar">
          <PresetSelector value={preset} onChange={handlePresetChange} />
          <BackgroundControls
            mode={cutoutSettings.mode}
            settings={cutoutSettings}
            onModeChange={(mode: BackgroundMode) =>
              setCutoutSettings((s) => ({ ...s, mode }))
            }
            onSettingsChange={setCutoutSettings}
          />
          <VectorizeOptions
            mode={vectorizeMode}
            tuning={vectorizeTuning}
            onModeChange={setVectorizeMode}
            onTuningChange={setVectorizeTuning}
          />
        </aside>

        <section className="app-content">
          {showEmpty ? (
            <DropZone onFile={handleFile} onError={(m) => handleError(m)} />
          ) : (
            <DropZone
              compact
              currentFileName={image!.file.name}
              onFile={handleFile}
              onError={(m) => handleError(m)}
            />
          )}

          <div className="preview-grid">
            <PreviewPane
              title="Original"
              meta={
                image
                  ? `${image.naturalWidth}×${image.naturalHeight}`
                  : undefined
              }
              empty={!image}
              emptyText="画像を読み込むと表示されます"
            >
              {image && (
                <img
                  src={image.objectUrl}
                  alt={image.file.name}
                  style={{ maxWidth: "100%", maxHeight: "100%" }}
                />
              )}
            </PreviewPane>

            <PreviewPane
              title="Cutout"
              meta={
                cutoutResult?.boundingBox
                  ? `trim ${cutoutResult.boundingBox.width}×${cutoutResult.boundingBox.height}`
                  : isComputing
                  ? "computing…"
                  : undefined
              }
              empty={!cutoutResult && !isComputing}
              emptyText={
                image
                  ? isComputing
                    ? "computing…"
                    : "背景処理を待機中…"
                  : "背景処理結果がここに表示されます"
              }
            >
              {cutoutResult && <CutoutPreview cutout={cutoutResult} />}
            </PreviewPane>

            <PreviewPane
              title="SVG"
              meta={
                vectorizeResult
                  ? `${vectorizeResult.width}×${vectorizeResult.height} · ${vectorizeResult.pathCount} paths`
                  : undefined
              }
              empty={!vectorizeResult}
              emptyText="「Convert」を押すと SVG が表示されます"
            >
              {vectorizeResult && (
                <div
                  style={{ width: "100%", height: "100%" }}
                  dangerouslySetInnerHTML={{ __html: vectorizeResult.svg }}
                />
              )}
            </PreviewPane>

            <div className="preview-pane">
              <div className="preview-pane-header">
                <strong>Vectorize</strong>
                <span className="meta">{vectorizeMode}</span>
              </div>
              <div
                className="preview-pane-body"
                style={{ flexDirection: "column", gap: "var(--space-3)" }}
              >
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  白背景除去のあと、<strong>vtracer</strong> で SVG に変換します。
                  PNG 派生も同時に生成されます。
                </div>
                <button
                  className="button button-large button-block"
                  disabled={
                    !image ||
                    isVectorizing ||
                    isGeneratingPng ||
                    isComputing
                  }
                  onClick={handleConvert}
                >
                  {isVectorizing
                    ? "Vectorizing…"
                    : isGeneratingPng
                    ? "Generating PNG…"
                    : "Convert"}
                </button>
                <div className="dim" style={{ fontSize: "var(--text-xs)" }}>
                  {image
                    ? `入力: ${image.file.name}`
                    : "画像が必要です"}
                </div>
              </div>
            </div>
          </div>

          <ExportButtons
            hasSvg={!!vectorizeResult}
            pngVariants={pngVariants}
            isBusy={isSaving}
            onSaveSvg={handleSaveSvg}
            onSavePng={handleSavePng}
          />
        </section>
      </main>

      <footer className="app-status">
        <span
          className={`app-status-dot ${
            status.working ? "is-working" : ""
          }`}
        />
        <span>{status.label}</span>
        {status.detail && <span className="dim">· {status.detail}</span>}
      </footer>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function CutoutPreview({ cutout }: { cutout: CutoutResult }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { imageData, boundingBox } = cutout;
    let target: { width: number; height: number };
    if (boundingBox) {
      target = { width: boundingBox.width, height: boundingBox.height };
    } else {
      target = { width: imageData.width, height: imageData.height };
    }
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (boundingBox) {
      const tmp = new OffscreenCanvas(imageData.width, imageData.height);
      const tmpCtx = tmp.getContext("2d");
      if (!tmpCtx) return;
      tmpCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(
        tmp,
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height,
        0,
        0,
        boundingBox.width,
        boundingBox.height,
      );
    } else {
      ctx.putImageData(imageData, 0, 0);
    }
  }, [cutout]);

  return <canvas ref={ref} style={{ maxWidth: "100%", maxHeight: "100%" }} />;
}

export default App;
