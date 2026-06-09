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
  cutoutToPngBytes,
  generatePngVariants,
  PngCancelledError,
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
  saveBundleToFolder,
  saveDialogAndWrite,
  vectorizeImage,
  vectorizeImageMulti,
  type BundleFile,
} from "./lib/tauriInvoke";
import type {
  BackgroundMode,
  CurvePreset,
  CutoutSettings,
  LoadedImage,
  ThemeName,
  ToastKind,
  ToastMessage,
  VectorizeMode,
  VectorizeModeSet,
  VectorizeResult,
  VectorizeTuning,
} from "./lib/types";

const THEME_STORAGE_KEY = "hazakura-vectorizer:theme";
const CUTOUT_DEBOUNCE_MS = 150;
const APP_VERSION = __APP_VERSION__;
const APP_REPOSITORY = "https://github.com/lero003/hazakura-vectorizer";
const APP_LICENSE = "MIT";
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
  const [vectorizeModes, setVectorizeModes] = useState<VectorizeModeSet>([
    initialPreset.mode,
  ]);
  const [activeMode, setActiveMode] = useState<VectorizeMode>(
    initialPreset.mode,
  );
  const [cutoutResult, setCutoutResult] = useState<CutoutResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  /** 0–100 while a cutout chunk is being processed; null when idle. */
  const [cutoutProgress, setCutoutProgress] = useState<number | null>(null);
  const [vectorizeResults, setVectorizeResults] = useState<
    Map<VectorizeMode, VectorizeResult>
  >(() => new Map());
  const [pngVariants, setPngVariants] = useState<PngVariant[]>([]);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  /** 0–100 while a PNG variant is being generated; null when idle. */
  const [pngProgress, setPngProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
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

  /**
   * Set of cancel tokens, one per in-flight cancellable operation. The
   * cutout effect and `handleConvert` each allocate their own token on
   * entry and remove it on exit. `handleCancel` flips every active token
   * so a user click during a concurrent run (e.g. cutout re-running
   * because the user dragged a slider mid-Convert) stops everything.
   */
  const cancelTokensRef = useRef<Set<{ cancelled: boolean }>>(new Set());

  // Active mode is the mode currently shown in the SVG preview pane and
  // targeted by the single-file Save buttons. It must always be a member of
  // `vectorizeModes`; this effect repairs the invariant after a mode toggle.
  useEffect(() => {
    if (!vectorizeModes.includes(activeMode) && vectorizeModes.length > 0) {
      setActiveMode(vectorizeModes[0]!);
    }
  }, [vectorizeModes, activeMode]);

  // Toggling the mode set invalidates the previous Convert result map —
  // any result whose key is no longer in the set is dropped. We don't
  // auto-re-run Convert; the user re-clicks it explicitly.
  useEffect(() => {
    setVectorizeResults((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map<VectorizeMode, VectorizeResult>();
      for (const mode of vectorizeModes) {
        const r = prev.get(mode);
        if (r) next.set(mode, r);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [vectorizeModes]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const pushToast = useCallback((toast: ToastMessage) => {
    setToasts((current) => {
      // Suppress duplicates with the same text+kind within the last 3 toasts
      // to avoid stacking the same message after rapid-fire actions.
      const recent = current.slice(-3);
      if (recent.some((t) => t.kind === toast.kind && t.text === toast.text)) {
        return current;
      }
      return [...current, toast];
    });
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
        setVectorizeResults(new Map());
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
    // Preset selection resets modes to the preset's primary mode only;
    // if the user has manually expanded to multi-mode, the next Convert
    // will respect whatever is currently checked. The mode-cleanup effect
    // below prunes the results map to whatever survives the new mode set.
    setVectorizeModes([p.mode]);
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

    // Each fresh effect run allocates its own cancel token. We capture it
    // in a local `token` so this closure is independent of the next
    // effect's token; the shared `cancelTokensRef` is the bus that
    // `handleCancel` walks to flip *every* live token. We also bump the
    // per-effect `jobId`; `isCancelled` returns true when either the
    // user cancelled (token) or this effect was superseded (jobId).
    const token = { cancelled: false };
    cancelTokensRef.current.add(token);
    const jobId = ++cutoutJobRef.current;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || cutoutJobRef.current !== jobId) return;
      // Honor a Cancel that landed during the 150ms debounce. The cancel
      // button itself is hidden in this window (nothing is "processing"
      // yet) but a fast user with a mouse-down on Cancel right after a
      // slider drag would otherwise still see the cutout spin up and
      // throw 200ms later. Checking here short-circuits the work.
      if (token.cancelled) return;
      setIsComputing(true);
      setCutoutProgress(0);
      try {
        const result = await applyCutoutAsync({
          bitmap: image.bitmap,
          background,
          settings: cutoutSettings,
          isCancelled: () => token.cancelled || cutoutJobRef.current !== jobId,
          onProgress: (percent) => {
            if (!token.cancelled && cutoutJobRef.current === jobId) {
              setCutoutProgress(percent);
            }
          },
        });
        if (cancelled || cutoutJobRef.current !== jobId) return;
        cutoutCacheRef.current = { key: cacheKey, result };
        setCutoutResult(result);
      } catch (err) {
        if (err instanceof CutoutCancelledError) {
          // Expected when the user clicks Cancel or a fresh effect supersedes
          // us. Either way, do not surface an error toast.
          return;
        }
        if (cancelled || cutoutJobRef.current !== jobId) return;
        handleError(
          "背景処理でエラー",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        if (cutoutJobRef.current === jobId) {
          setIsComputing(false);
          setCutoutProgress(null);
        }
      }
    }, CUTOUT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelTokensRef.current.delete(token);
      // If this effect is being torn down mid-computation (slider move,
      // new image, unmount), make sure we don't leave isComputing stuck
      // on. The `jobId` check guards against a delayed cleanup racing a
      // fresh effect that already took over.
      if (cutoutJobRef.current === jobId) {
        setIsComputing(false);
        setCutoutProgress(null);
      }
    };
  }, [image, cutoutSettings, background, handleError]);

  // Reset PNG variants when image or cutout result changes
  useEffect(() => {
    setPngVariants([]);
  }, [image, cutoutResult]);

  const handleConvert = useCallback(async () => {
    if (!image) return;
    // Our own token. A concurrent cutout effect re-run (user dragging a
    // slider while Convert is generating PNG) won't disturb us because
    // we read `token.cancelled` directly, not the shared ref.
    const token = { cancelled: false };
    cancelTokensRef.current.add(token);
    setIsVectorizing(true);
    setPngVariants([]);
    setVectorizeResults(new Map());
    try {
      // Vectorize the cutout PNG (transparent background) rather than the
      // original image, so vtracer doesn't emit a full-canvas background
      // path that later variants have to override.
      const sourceBytes = cutoutResult
        ? await cutoutToPngBytes(cutoutResult)
        : new Uint8Array(await image.file.arrayBuffer());

      const tuning = {
        colorPrecision: vectorizeTuning.colorPrecision,
        cornerThreshold: vectorizeTuning.cornerThreshold,
        filterSpeckle: vectorizeTuning.filterSpeckle,
        segmentLength: vectorizeTuning.segmentLength,
        spliceThreshold: vectorizeTuning.spliceThreshold,
      };

      const nextResults = new Map<VectorizeMode, VectorizeResult>();
      if (vectorizeModes.length === 1) {
        const mode = vectorizeModes[0]!;
        const raw = await vectorizeImage(sourceBytes, { mode, ...tuning });
        nextResults.set(mode, {
          ...raw,
          svg: ensureViewBox(stripMetadata(raw.svg)),
        });
      } else {
        const raw = await vectorizeImageMulti(
          sourceBytes,
          vectorizeModes.map((mode) => ({ key: mode, options: { mode, ...tuning } })),
        );
        for (const entry of raw) {
          const mode = entry.key as VectorizeMode;
          if (!vectorizeModes.includes(mode)) continue;
          nextResults.set(mode, {
            svg: ensureViewBox(stripMetadata(entry.svg)),
            width: entry.width,
            height: entry.height,
            pathCount: entry.pathCount,
          });
        }
      }
      setVectorizeResults(nextResults);
      // Make sure the preview focuses on a mode that actually has a result.
      if (!nextResults.has(activeMode) && nextResults.size > 0) {
        const firstMode = vectorizeModes.find((m) => nextResults.has(m));
        if (firstMode) setActiveMode(firstMode);
      }

      const totalPaths = Array.from(nextResults.values()).reduce(
        (acc, r) => acc + r.pathCount,
        0,
      );
      pushToast(
        makeToast(
          "success",
          vectorizeModes.length > 1
            ? `SVG 変換完了 (${vectorizeModes.length} 形式)`
            : "SVG 変換完了",
          `${totalPaths} paths / ${nextResults.values().next().value?.width ?? 0}×${
            nextResults.values().next().value?.height ?? 0
          }`,
        ),
      );

      if (cutoutResult) {
        setIsGeneratingPng(true);
        setPngProgress(0);
        try {
          const variants = await generatePngVariants({
            cutout: cutoutResult,
            baseName: image.file.name,
            includeTransparent: true,
            includeWhiteBackground: true,
            png512: true,
            png1024: true,
            isCancelled: () => token.cancelled,
            onProgress: (percent) => {
              if (!token.cancelled) {
                setPngProgress(percent);
              }
            },
          });
          setPngVariants(variants);
          pushToast(makeToast("success", "PNG 派生を生成しました"));
        } catch (err) {
          if (err instanceof PngCancelledError) {
            // User cancelled PNG gen. SVG result is still valid; just
            // inform without the error toast styling.
            pushToast(makeToast("info", "PNG 派生生成をキャンセルしました"));
            return;
          }
          handleError(
            "PNG 派生生成に失敗",
            err instanceof Error ? err.message : String(err),
          );
        } finally {
          setIsGeneratingPng(false);
          setPngProgress(null);
        }
      }
    } catch (err) {
      if (err instanceof PngCancelledError) {
        pushToast(makeToast("info", "処理をキャンセルしました"));
        return;
      }
      handleError(
        "変換に失敗しました",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      cancelTokensRef.current.delete(token);
      setIsVectorizing(false);
    }
  }, [
    image,
    vectorizeModes,
    vectorizeTuning,
    cutoutResult,
    activeMode,
    pushToast,
    handleError,
  ]);

  const baseName = useMemo(() => {
    if (!image) return "asset";
    return image.file.name.replace(/\.[^.]+$/, "");
  }, [image]);

  const isMultiMode = vectorizeModes.length > 1;
  const activeResult = vectorizeResults.get(activeMode) ?? null;

  const svgFilenameSuffix = useCallback(
    (mode: VectorizeMode, kind: "original" | "black" | "white"): string => {
      // In single-mode we keep the legacy "-original" / "-black" / "-white"
      // suffix so existing automations don't break. Multi-mode prefixes the
      // mode so both flavors can coexist in the same folder.
      return isMultiMode ? `${mode}-${kind}` : kind;
    },
    [isMultiMode],
  );

  const buildSvg = useCallback(
    (svg: string, kind: "original" | "black" | "white"): string => {
      if (kind === "black") return blackVariant(svg);
      if (kind === "white") return whiteVariant(svg);
      return svg;
    },
    [],
  );

  const handleSaveSvg = useCallback(
    async (mode: VectorizeMode, kind: "original" | "black" | "white") => {
      const result = vectorizeResults.get(mode);
      if (!result) return;
      setIsSaving(true);
      try {
        const svg = buildSvg(result.svg, kind);
        const filename = `${baseName}-${svgFilenameSuffix(mode, kind)}.svg`;
        const savedPath = await saveDialogAndWrite({
          contentsBase64: bytesToBase64(new TextEncoder().encode(svg)),
          suggestedFilename: filename,
          fileKind: "svg",
          title: `${mode === "bw" ? "Monochrome" : "Color"} ${kind} SVG を保存`,
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
    [vectorizeResults, baseName, buildSvg, svgFilenameSuffix, pushToast, handleError],
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

  // Save every available SVG variant and PNG variant in one shot, by
  // prompting the user to pick a destination folder. PNG variants are
  // mode-independent and included once; SVG variants cover every mode
  // that has a Convert result, in stable order.
  const handleSaveAll = useCallback(async () => {
    if (vectorizeResults.size === 0 || pngVariants.length === 0) return;
    setIsSaving(true);
    try {
      const files: BundleFile[] = [];
      for (const mode of vectorizeModes) {
        const r = vectorizeResults.get(mode);
        if (!r) continue;
        for (const kind of ["original", "black", "white"] as const) {
          const svg = buildSvg(r.svg, kind);
          files.push({
            filename: `${baseName}-${svgFilenameSuffix(mode, kind)}.svg`,
            contentsBase64: bytesToBase64(new TextEncoder().encode(svg)),
          });
        }
      }
      for (const variant of pngVariants) {
        const bytes = new Uint8Array(await variant.blob.arrayBuffer());
        files.push({
          filename: `${baseName}-${variant.filenameSuffix}.png`,
          contentsBase64: bytesToBase64(bytes),
        });
      }
      const result = await saveBundleToFolder({
        files,
        title: "全形式を書き出す先を選択",
      });
      if (result && result.written.length > 0) {
        pushToast(
          makeToast(
            "success",
            `全形式を保存しました (${result.written.length} ファイル)`,
            result.targetDir,
          ),
        );
      }
    } catch (err) {
      handleError(
        "一括保存に失敗しました",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    vectorizeModes,
    vectorizeResults,
    pngVariants,
    baseName,
    buildSvg,
    svgFilenameSuffix,
    pushToast,
    handleError,
  ]);

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  /** User-initiated cancel. Flips every active token; in-flight cutout
   *  and PNG export check their token at safe points and abort cleanly.
   *  vtracer is not currently cancellable (separate OS process, no
   *  plumbing) — the cancel button stays hidden while vtracer is the
   *  only thing running. */
  const handleCancel = useCallback(() => {
    let cancelledSomething = false;
    for (const token of cancelTokensRef.current) {
      if (!token.cancelled) {
        cancelledSomething = true;
        token.cancelled = true;
      }
    }
    if (!cancelledSomething) return;
    pushToast(makeToast("info", "処理をキャンセルしました"));
  }, [pushToast]);

  const isProcessing = isComputing || isGeneratingPng;

  const handleShowAbout = useCallback(() => {
    setIsAboutOpen(true);
  }, []);

  const handleCloseAbout = useCallback(() => {
    setIsAboutOpen(false);
  }, []);

  const showEmpty = !image;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-mark" aria-hidden />
          <span>Hazakura Vectorizer</span>
          <small>v{APP_VERSION}</small>
        </div>
        <div className="app-header-actions">
          <button
            type="button"
            className="button-ghost about-button"
            onClick={handleShowAbout}
            aria-label="このアプリについて"
          >
            About
          </button>
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
            modes={vectorizeModes}
            activeMode={activeMode}
            tuning={vectorizeTuning}
            onModesChange={setVectorizeModes}
            onTuningChange={setVectorizeTuning}
          />
          <div className="convert-bar">
            <div className="convert-bar-status">
              <span
                className={`app-status-dot ${
                  isVectorizing || isGeneratingPng || isComputing ? "is-working" : ""
                }`}
                aria-hidden
              />
              <span className="convert-bar-status-text">
                {isVectorizing
                  ? vectorizeModes.length > 1
                    ? `Vectorizing (${vectorizeModes.length} 形式)…`
                    : "Vectorizing…"
                  : isGeneratingPng
                  ? `PNG 派生を生成中${
                      pngProgress != null ? ` · ${pngProgress}%` : ""
                    }`
                  : isComputing
                  ? `背景処理中${
                      cutoutProgress != null ? ` · ${cutoutProgress}%` : ""
                    }`
                  : image
                  ? "準備完了 — Convert を押してください"
                  : "画像をドロップしてください"}
              </span>
              {isProcessing && (
                <button
                  type="button"
                  className="button-ghost convert-bar-cancel"
                  onClick={handleCancel}
                  aria-label="処理をキャンセル"
                >
                  ✕ キャンセル
                </button>
              )}
            </div>
            {isVectorizing ? (
              // Vectorize is the operation the user just kicked off, so
              // its indeterminate bar takes precedence over the cutout's
              // determinate bar. A concurrent cutout (user dragged a
              // slider mid-Convert) is a side effect; we just don't
              // surface it visually.
              <div
                className="convert-bar-progress is-indeterminate"
                role="progressbar"
                aria-label="ベクター化の進捗"
              >
                <div className="convert-bar-progress-fill" />
              </div>
            ) : (isComputing || isGeneratingPng) ? (
              <div
                className="convert-bar-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  isComputing ? (cutoutProgress ?? 0) : (pngProgress ?? 0)
                }
                aria-label={
                  isComputing
                    ? "背景処理の進捗"
                    : "PNG 派生生成の進捗"
                }
              >
                <div
                  className="convert-bar-progress-fill"
                  style={{
                    width: `${
                      isComputing
                        ? cutoutProgress ?? 0
                        : pngProgress ?? 0
                    }%`,
                  }}
                />
              </div>
            ) : null}
            <button
              className="button button-large"
              disabled={
                !image ||
                isVectorizing ||
                isGeneratingPng ||
                isComputing
              }
              onClick={handleConvert}
              aria-label="Convert to SVG and PNG variants"
            >
              {isVectorizing
                ? "Vectorizing…"
                : isGeneratingPng
                ? "Generating PNG…"
                : "Convert"}
            </button>
          </div>
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
                  ? `${cutoutResult.boundingBox.width} × ${cutoutResult.boundingBox.height}`
                  : isComputing
                  ? ""
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
                activeResult
                  ? `${activeResult.width}×${activeResult.height} · ${activeResult.pathCount} paths`
                  : undefined
              }
              headerExtra={
                isMultiMode && vectorizeResults.size > 1 ? (
                  <div
                    className="mode-chip-group"
                    role="tablist"
                    aria-label="表示するモード"
                  >
                    {vectorizeModes.map((mode) => {
                      const has = vectorizeResults.has(mode);
                      if (!has) return null;
                      const label = mode === "color" ? "Color" : "Monochrome";
                      return (
                        <button
                          key={mode}
                          type="button"
                          role="tab"
                          aria-selected={activeMode === mode}
                          className={`mode-chip ${
                            activeMode === mode ? "is-active" : ""
                          }`}
                          onClick={() => setActiveMode(mode)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null
              }
              empty={!activeResult}
              emptyText="「Convert」を押すと SVG が表示されます"
            >
              {activeResult && (
                <div
                  className="svg-preview-host"
                  role="img"
                  aria-label={`ベクター化されたSVGプレビュー ${activeResult.width}×${activeResult.height}, ${activeResult.pathCount} パス`}
                  dangerouslySetInnerHTML={{ __html: activeResult.svg }}
                />
              )}
            </PreviewPane>
          </div>

          <ExportButtons
            hasSvg={vectorizeResults.size > 0}
            modes={vectorizeModes}
            svgResults={vectorizeResults}
            pngVariants={pngVariants}
            isBusy={isSaving}
            onSaveSvg={handleSaveSvg}
            onSavePng={handleSavePng}
            onSaveAll={handleSaveAll}
          />
        </section>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {isAboutOpen && (
        <AboutDialog
          version={APP_VERSION}
          repository={APP_REPOSITORY}
          license={APP_LICENSE}
          onClose={handleCloseAbout}
        />
      )}
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

function AboutDialog({
  version,
  repository,
  license,
  onClose,
}: {
  version: string;
  repository: string;
  license: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="about-title">Hazakura Vectorizer</h2>
          <button
            type="button"
            className="button-ghost"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-tagline">
            ローカル完結の PNG / JPG / WebP → SVG ベクター化ツール。
          </p>
          <dl className="modal-meta">
            <div>
              <dt>バージョン</dt>
              <dd>
                <code>v{version}</code>
              </dd>
            </div>
            <div>
              <dt>エンジン</dt>
              <dd>
                <code>vtracer</code> 同梱
              </dd>
            </div>
            <div>
              <dt>ライセンス</dt>
              <dd>
                <code>{license}</code>
              </dd>
            </div>
            <div>
              <dt>ソース</dt>
              <dd>
                <a href={repository} target="_blank" rel="noreferrer">
                  {repository}
                </a>
              </dd>
            </div>
          </dl>
          <p className="modal-note">
            画像は外部送信されません。すべての処理はこの Mac の中で完結します。
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
