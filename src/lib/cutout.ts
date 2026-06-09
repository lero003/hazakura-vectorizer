import type { BackgroundMode, CutoutSettings } from "./types";

export type RGBA = [number, number, number, number];

const SAMPLE_EDGE_PERCENT = 0.04;
const CHUNK_PIXELS = 250_000;

export class CutoutCancelledError extends Error {
  constructor() {
    super("cutout cancelled");
    this.name = "CutoutCancelledError";
  }
}

function samplePoint(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): RGBA {
  const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
  const i = (yi * width + xi) * 4;
  return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
}

function averageColor(samples: RGBA[]): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const s of samples) {
    r += s[0];
    g += s[1];
    b += s[2];
  }
  const n = samples.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function looksLikeWhiteBackground(rgb: [number, number, number]): boolean {
  const avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
  const variance =
    Math.abs(rgb[0] - avg) +
    Math.abs(rgb[1] - avg) +
    Math.abs(rgb[2] - avg);
  return avg > 220 && variance < 30;
}

export function estimateBackgroundColor(
  bitmap: ImageBitmap,
): [number, number, number] | null {
  const w = bitmap.width;
  const h = bitmap.height;

  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  const edgeSize = Math.max(2, Math.round(Math.min(w, h) * SAMPLE_EDGE_PERCENT));
  const samples: RGBA[] = [];

  for (let x = 0; x < edgeSize; x++) {
    samples.push(samplePoint(data, w, h, x, 0));
    samples.push(samplePoint(data, w, h, x, h - 1));
    samples.push(samplePoint(data, w, h, 0, x));
    samples.push(samplePoint(data, w, h, w - 1, x));
  }

  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 16))) {
    samples.push(samplePoint(data, w, h, 0, y));
    samples.push(samplePoint(data, w, h, w - 1, y));
  }
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 16))) {
    samples.push(samplePoint(data, w, h, x, 0));
    samples.push(samplePoint(data, w, h, x, h - 1));
  }

  const opaqueSamples = samples.filter((s) => s[3] > 200);
  const pool = opaqueSamples.length > 0 ? opaqueSamples : samples;
  return averageColor(pool);
}

export function resolveBackgroundMode(
  requested: BackgroundMode,
  estimated: [number, number, number] | null,
): Exclude<BackgroundMode, "auto"> {
  if (requested !== "auto") return requested;
  if (!estimated) return "keep-transparent";
  return looksLikeWhiteBackground(estimated) ? "remove-white" : "keep-transparent";
}

export interface CutoutResult {
  imageData: ImageData;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

function findBoundingBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function defringe(
  rgba: Uint8ClampedArray,
  bg: [number, number, number],
  threshold: number,
  softRange: number,
) {
  const t0 = Math.max(0, threshold - softRange / 2);
  const t1 = threshold + softRange / 2;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const a = rgba[i + 3]!;
    if (a === 0) continue;
    const dr = r - bg[0];
    const dg = g - bg[1];
    const db = b - bg[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < t0) {
      rgba[i + 3] = 0;
    } else if (dist < t1 && a < 255) {
      const ratio = (dist - t0) / (t1 - t0);
      rgba[i + 3] = Math.round(a * ratio);
    } else if (dist < t1) {
      rgba[i] = bg[0];
      rgba[i + 1] = bg[1];
      rgba[i + 2] = bg[2];
      rgba[i + 3] = Math.max(0, Math.round(255 * ((dist - t0) / (t1 - t0))));
    }
  }
}

export interface ApplyCutoutOptions {
  bitmap: ImageBitmap;
  background: [number, number, number] | null;
  settings: CutoutSettings;
  isCancelled?: () => boolean;
  /** Optional progress callback. Fired at the start of each chunk with a
   *  percentage in [0, 100]. For the early-return paths (keep-transparent /
   *  white-background / no-background), it fires once with 100. */
  onProgress?: (percent: number) => void;
}

export async function applyCutoutAsync({
  bitmap,
  background,
  settings,
  isCancelled,
  onProgress,
}: ApplyCutoutOptions): Promise<CutoutResult> {
  const cancelled = isCancelled ?? (() => false);
  const checkCancel = () => {
    if (cancelled()) throw new CutoutCancelledError();
  };
  const reportProgress = (percent: number) => {
    if (onProgress) onProgress(Math.max(0, Math.min(100, percent)));
  };

  const w = bitmap.width;
  const h = bitmap.height;

  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext("2d");
  if (!ctx) throw new Error("2D context not available");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const effectiveMode = resolveBackgroundMode(settings.mode, background);

  if (effectiveMode === "keep-transparent") {
    checkCancel();
    const bbox = findBoundingBox(data, w, h);
    reportProgress(100);
    return { imageData, boundingBox: bbox };
  }

  if (effectiveMode === "white-background") {
    checkCancel();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    const filled = ctx.getImageData(0, 0, w, h);
    reportProgress(100);
    return { imageData: filled, boundingBox: null };
  }

  if (!background) {
    checkCancel();
    const bbox = findBoundingBox(data, w, h);
    reportProgress(100);
    return { imageData, boundingBox: bbox };
  }

  const threshold = settings.whiteThreshold;
  const softRange = Math.max(1, settings.edgeSoftness);
  const t0 = Math.max(0, threshold);
  const t1 = threshold + softRange;
  const totalPixels = data.length / 4;

  for (let chunkStart = 0; chunkStart < totalPixels; chunkStart += CHUNK_PIXELS) {
    if (chunkStart > 0) {
      checkCancel();
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    // Reserve the last 10% of the bar for the post-processing steps below
    // (fringe removal + bbox scan). The chunked scan itself is the bulk
    // of the work, so we map it to 0-90%.
    reportProgress(Math.floor((chunkStart / totalPixels) * 90));
    const chunkEnd = Math.min(chunkStart + CHUNK_PIXELS, totalPixels);
    for (let p = chunkStart; p < chunkEnd; p++) {
      const i = p * 4;
      const a = data[i + 3]!;
      if (a === 0) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const dr = r - background[0];
      const dg = g - background[1];
      const db = b - background[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= t0) {
        data[i + 3] = 0;
      } else if (dist < t1) {
        const ratio = (dist - t0) / (t1 - t0);
        data[i + 3] = Math.round(a * Math.min(1, ratio));
      }
    }
  }

  if (settings.removeFringe) {
    checkCancel();
    reportProgress(92);
    defringe(data, background, threshold, softRange);
  }

  checkCancel();
  reportProgress(96);
  const bbox = findBoundingBox(data, w, h);
  reportProgress(100);
  return { imageData, boundingBox: bbox };
}
