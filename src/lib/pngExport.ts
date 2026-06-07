import type { CutoutResult } from "./cutout";

export interface PngVariant {
  key: string;
  label: string;
  filenameSuffix: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface PngExportSpec {
  cutout: CutoutResult;
  baseName: string;
  includeWhiteBackground: boolean;
  includeTransparent: boolean;
  png512: boolean;
  png1024: boolean;
}

export async function generatePngVariants(spec: PngExportSpec): Promise<PngVariant[]> {
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

  if (spec.includeTransparent) {
    const blob = await renderTransparent(trimmed);
    out.push({
      key: "transparent",
      label: "透過 PNG",
      filenameSuffix: "transparent",
      blob,
      width: trimmed.width,
      height: trimmed.height,
    });
  }

  if (spec.includeWhiteBackground) {
    const blob = await renderWhite(trimmed);
    out.push({
      key: "white",
      label: "白背景 PNG",
      filenameSuffix: "white",
      blob,
      width: trimmed.width,
      height: trimmed.height,
    });
  }

  if (spec.png512) {
    const fitted = fitInside(trimmed, 512, 512);
    const blob = await renderTransparent(fitted);
    out.push({
      key: "png-512",
      label: "PNG 512px",
      filenameSuffix: "512",
      blob,
      width: fitted.width,
      height: fitted.height,
    });
  }

  if (spec.png1024) {
    const fitted = fitInside(trimmed, 1024, 1024);
    const blob = await renderTransparent(fitted);
    out.push({
      key: "png-1024",
      label: "PNG 1024px",
      filenameSuffix: "1024",
      blob,
      width: fitted.width,
      height: fitted.height,
    });
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
