import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export interface PickedImage {
  uri: string;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
}

// Mirrors the web's compressImage(): max-edge 1600 px, JPEG q ≈ 0.85.
// A typical phone screenshot (1080–1290 px wide) lands well under 300 KB
// after this. We always normalise to JPEG so the server-side path doesn't
// have to special-case PNG transparency for payment proofs.
const MAX_EDGE = 1600;
const QUALITY = 0.85;
const SKIP_BELOW_BYTES = 350 * 1024;

async function fileSize(uri: string): Promise<number> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size;
  } catch {
    return 0;
  }
}

export async function ensurePermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === "granted";
}

export async function pickAndCompressImage(): Promise<PickedImage | null> {
  const granted = await ensurePermission();
  if (!granted) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
    exif: false,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];

  return compressLocalImage(asset.uri, {
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    fileSize: asset.fileSize,
  });
}

export async function captureAndCompressImage(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return null;

  const res = await ImagePicker.launchCameraAsync({
    quality: 1,
    exif: false,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];

  return compressLocalImage(asset.uri, {
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    fileSize: asset.fileSize,
  });
}

async function compressLocalImage(
  uri: string,
  src: { width: number; height: number; fileSize?: number },
): Promise<PickedImage> {
  const rawSize = src.fileSize ?? (await fileSize(uri));
  const longEdge = Math.max(src.width, src.height);

  // Already small AND already within size budget → skip the re-encode.
  if (rawSize && rawSize < SKIP_BELOW_BYTES && longEdge <= MAX_EDGE) {
    const name = guessName(uri);
    return {
      uri,
      name,
      type: guessMime(name),
      size: rawSize,
      width: src.width,
      height: src.height,
    };
  }

  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
  const targetW = Math.round(src.width * scale);
  const targetH = Math.round(src.height * scale);

  const actions =
    scale < 1 && targetW > 0 && targetH > 0
      ? [{ resize: { width: targetW, height: targetH } }]
      : [];
  const saved = await manipulateAsync(uri, actions, {
    format: SaveFormat.JPEG,
    compress: QUALITY,
  });

  const finalSize = (await fileSize(saved.uri)) || rawSize;

  return {
    uri: saved.uri,
    name: `screenshot-${Date.now()}.jpg`,
    type: "image/jpeg",
    size: finalSize,
    width: saved.width ?? targetW,
    height: saved.height ?? targetH,
  };
}

function guessName(uri: string): string {
  const last = uri.split("/").pop() || `screenshot-${Date.now()}.jpg`;
  return last.includes(".") ? last : `${last}.jpg`;
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
