import { invoke } from "@tauri-apps/api/core";
import type { VectorizeResult } from "./types";

interface VectorizeOptionsArgs {
  mode: "color" | "bw";
  colorPrecision: number;
  cornerThreshold: number;
  filterSpeckle: number;
  segmentLength: number;
  spliceThreshold: number;
}

export function vectorizeImage(
  imageBytes: Uint8Array,
  options: VectorizeOptionsArgs,
): Promise<VectorizeResult> {
  return invoke<VectorizeResult>("vectorize_image", {
    imageBytes: Array.from(imageBytes),
    options,
  });
}

export interface SaveRequest {
  contentsBase64: string;
  suggestedFilename: string;
  fileKind: "svg" | "png";
  title: string;
}

export function saveDialogAndWrite(
  request: SaveRequest,
): Promise<string | null> {
  return invoke<string | null>("save_dialog_and_write", { request });
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function readImageFile(path: string): Promise<number[]> {
  return invoke<number[]>("read_image_file", { path });
}
