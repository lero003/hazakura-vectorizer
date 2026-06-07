export type BackgroundMode = "auto" | "keep-transparent" | "remove-white" | "white-background";

export type CurvePreset = "logo" | "icon" | "simple-color" | "monochrome";

export type VectorizeMode = "color" | "bw";

export type Level = "low" | "medium" | "high";

export interface VectorizePreset {
  id: CurvePreset;
  label: string;
  description: string;
  mode: VectorizeMode;
  backgroundMode: BackgroundMode;
  colorPrecision: number;
  whiteThreshold: number;
  edgeSoftness: number;
  removeFringe: boolean;
  filterSpeckle: number;
  cornerThreshold: number;
  segmentLength: number;
  spliceThreshold: number;
}

export interface CutoutSettings {
  mode: BackgroundMode;
  whiteThreshold: number;
  edgeSoftness: number;
  removeFringe: boolean;
}

export interface VectorizeTuning {
  colorPrecision: number;
  filterSpeckle: number;
  cornerThreshold: number;
  segmentLength: number;
  spliceThreshold: number;
}

export interface LoadedImage {
  file: File;
  bitmap: ImageBitmap;
  objectUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface VectorizeResult {
  svg: string;
  width: number;
  height: number;
  pathCount: number;
}

export type ToastKind = "info" | "success" | "error" | "warning";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
  detail?: string;
}

export type ThemeName = "light" | "dark";
