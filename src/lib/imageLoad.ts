import type { LoadedImage } from "./types";

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const MAX_DIMENSION = 4096;
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp";
}

export function validateImageFile(file: File): string | null {
  if (!isAcceptedFile(file)) {
    return "対応していない形式です。PNG / JPG / WebP を指定してください。";
  }
  if (file.size > MAX_FILE_SIZE) {
    return `ファイルサイズが大きすぎます(${Math.round(file.size / 1024 / 1024)}MB)。上限 ${MAX_FILE_SIZE / 1024 / 1024}MB。`;
  }
  return null;
}

export async function loadImage(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  if (
    bitmap.width > MAX_DIMENSION ||
    bitmap.height > MAX_DIMENSION
  ) {
    bitmap.close();
    throw new Error(
      `画像が大きすぎます(${bitmap.width}×${bitmap.height})。上限 ${MAX_DIMENSION}px。`,
    );
  }
  const objectUrl = URL.createObjectURL(file);
  return {
    file,
    bitmap,
    objectUrl,
    naturalWidth: bitmap.width,
    naturalHeight: bitmap.height,
  };
}

export function disposeImage(image: LoadedImage | null) {
  if (!image) return;
  URL.revokeObjectURL(image.objectUrl);
  image.bitmap.close();
}
