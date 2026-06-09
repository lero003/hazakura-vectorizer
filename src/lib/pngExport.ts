import type { CutoutResult } from "./cutout";

export interface PngVariant {
  key: string;
  label: string;
  filenameSuffix: string;
  blob: Blob;
  width: number;
  height: number;
}

export class PngCancelledError extends Error {
  constructor() {
    super("png export cancelled");
    this.name = "PngCancelledError";
  }
}

export interface PngExportSpec {
  cutout: CutoutResult;
  baseName: string;
  includeWhiteBackground: boolean;
  includeTransparent: boolean;
  png512: boolean;
  png1024: boolean;
  /** Optional progress callback. Fired after each variant is rendered with
   *  a percentage in [0, 100]. Reports 100 when all variants are done. */
  onProgress?: (percent: number) => void;
  /** Optional cancellation check. Throws `PngCancelledError` when truthy. */
  isCancelled?: () => boolean;
}

export async function generatePngVariants(spec: PngExportSpec): Promise<PngVariant[]> {
  const cancelled = spec.isCancelled ?? (() => false);
  const reportProgress = (percent: number) => {
    if (spec.onProgress) {
      spec.onProgress(Math.max(0, Math.min(100, percent)));
    }
  };
  const checkCancel = () => {
    if (cancelled()) throw new PngCancelledError();
  };

  const out: PngVariant[] = [];
  const trimmed = spec.cutout.boundingBox
    ? {
        imageData: trim(spec.cutout.imageData, spec.cutout.boundingBox),
        width: spec.cutout.boundingBox.width,
        height: spec.cutout.boundingBox.height,
      }
    : {
        imageData: spec.cutout.imageData,
        width: spec.cutout.imageData.width,
        height: spec.cutout.imageData.height,
      };

  // Plan the work so we can report granular progress without doing extra
  // math per variant. We yield to the event loop between variants so the
  // progress bar actually repaints and cancel checks are observed.
  const steps: Array<{ label: string; run: () => Promise<PngVariant> }> = [];
  if (spec.includeTransparent) {
    steps.push({
      label: "transparent",
      run: async () => ({
        key: "transparent",
        label: "透過 PNG",
        filenameSuffix: "transparent",
        blob: await renderTransparent(trimmed),
        width: trimmed.width,
        height: trimmed.height,
      }),
    });
  }
  if (spec.includeWhiteBackground) {
    steps.push({
      label: "white",
      run: async () => ({
        key: "white",
        label: "白背景 PNG",
        filenameSuffix: "white",
        blob: await renderWhite(trimmed),
        width: trimmed.width,
        height: trimmed.height,
      }),
    });
  }
  if (spec.png512) {
    steps.push({
      label: "png-512",
      run: async () => {
        const fitted = fitInside(trimmed, 512, 512);
        return {
          key: "png-512",
          label: "PNG 512px",
          filenameSuffix: "512",
          blob: await renderTransparent(fitted),
          width: fitted.width,
          height: fitted.height,
        };
      },
    });
  }
  if (spec.png1024) {
    steps.push({
      label: "png-1024",
      run: async () => {
        const fitted = fitInside(trimmed, 1024, 1024);
        return {
          key: "png-1024",
          label: "PNG 1024px",
          filenameSuffix: "1024",
          blob: await renderTransparent(fitted),
          width: fitted.width,
          height: fitted.height,
        };
      },
    });
  }

  reportProgress(0);
  for (let i = 0; i < steps.length; i++) {
    checkCancel();
    // Yield so React can paint progress + so a queued cancel can land.
    await new Promise<void>((r) => setTimeout(r, 0));
    const variant = await steps[i]!.run();
    out.push(variant);
    reportProgress(Math.round(((i + 1) / steps.length) * 100));
  }
  return out;
}

function trim(
  image: ImageData,
  bbox: { x: number; y: number; width: number; height: number },
): ImageData {
  const canvas = new OffscreenCanvas(bbox.width, bbox.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  const src = new OffscreenCanvas(image.width, image.height);
  const srcCtx = src.getContext("2d");
  if (!srcCtx) return image;
  srcCtx.putImageData(image, 0, 0);
  ctx.drawImage(src, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height);
  return ctx.getImageData(0, 0, bbox.width, bbox.height);
}

function fitInside(
  image: { imageData: ImageData; width: number; height: number },
  maxW: number,
  maxH: number,
): { imageData: ImageData; width: number; height: number } {
  const ratio = Math.min(maxW / image.width, maxH / image.height, 1);
  const w = Math.max(1, Math.round(image.width * ratio));
  const h = Math.max(1, Math.round(image.height * ratio));

  const src = new OffscreenCanvas(image.width, image.height);
  const srcCtx = src.getContext("2d");
  if (!srcCtx) return image;
  srcCtx.putImageData(image.imageData, 0, 0);

  const dst = new OffscreenCanvas(w, h);
  const dstCtx = dst.getContext("2d");
  if (!dstCtx) return image;
  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = "high";
  dstCtx.drawImage(src, 0, 0, w, h);
  return { imageData: dstCtx.getImageData(0, 0, w, h), width: w, height: h };
}

async function renderTransparent(image: {
  imageData: ImageData;
  width: number;
  height: number;
}): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available");
  const src = new OffscreenCanvas(image.width, image.height);
  const srcCtx = src.getContext("2d");
  if (!srcCtx) throw new Error("2D context not available");
  srcCtx.putImageData(image.imageData, 0, 0);
  ctx.drawImage(src, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

async function renderWhite(image: {
  imageData: ImageData;
  width: number;
  height: number;
}): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const src = new OffscreenCanvas(image.width, image.height);
  const srcCtx = src.getContext("2d");
  if (!srcCtx) throw new Error("2D context not available");
  srcCtx.putImageData(image.imageData, 0, 0);
  ctx.drawImage(src, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Convert a CutoutResult (potentially with bounding-box trim) to PNG bytes.
 * Used for handing the cutout image to vtracer so the white background is
 * not vectorized as a path.
 */
export async function cutoutToPngBytes(cutout: CutoutResult): Promise<Uint8Array> {
  const trimmed = cutout.boundingBox
    ? {
        imageData: trim(cutout.imageData, cutout.boundingBox),
        width: cutout.boundingBox.width,
        height: cutout.boundingBox.height,
      }
    : {
        imageData: cutout.imageData,
        width: cutout.imageData.width,
        height: cutout.imageData.height,
      };
  const blob = await renderTransparent(trimmed);
  return blobToBytes(blob);
}
