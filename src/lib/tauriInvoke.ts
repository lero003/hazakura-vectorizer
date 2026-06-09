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

export interface VectorizeMultiSpec {
  key: string;
  options: VectorizeOptionsArgs;
}

export interface VectorizeMultiEntry {
  key: string;
  svg: string;
  width: number;
  height: number;
  pathCount: number;
}

export function vectorizeImageMulti(
  imageBytes: Uint8Array,
  specs: VectorizeMultiSpec[],
): Promise<VectorizeMultiEntry[]> {
  return invoke<VectorizeMultiEntry[]>("vectorize_image_multi", {
    imageBytes: Array.from(imageBytes),
    specs,
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

export interface BundleFile {
  filename: string;
  contentsBase64: string;
}

export interface BundleRequest {
  files: BundleFile[];
  title: string;
}

export interface BundleWriteResult {
  targetDir: string;
  written: string[];
}

export function saveBundleToFolder(
  request: BundleRequest,
): Promise<BundleWriteResult | null> {
  return invoke<BundleWriteResult | null>("save_bundle_to_folder", { request });
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
