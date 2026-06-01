import type { AssetOrientation, SceneAnalysis, UploadAnalysisInput } from "@/lib/types";

export interface ParsedImageMetadata {
  width: number;
  height: number;
  orientation: AssetOrientation;
}

function orientationOf(width: number, height: number): AssetOrientation {
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

function readAscii(buffer: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...buffer.subarray(start, end));
}

function readUInt16BE(buffer: Uint8Array, offset: number) {
  return new DataView(buffer.buffer, buffer.byteOffset + offset, 2).getUint16(0, false);
}

function readUInt32BE(buffer: Uint8Array, offset: number) {
  return new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, false);
}

function readUInt16LE(buffer: Uint8Array, offset: number) {
  return new DataView(buffer.buffer, buffer.byteOffset + offset, 2).getUint16(0, true);
}

function readUInt32LE(buffer: Uint8Array, offset: number) {
  return new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
}

function readUIntLE3(buffer: Uint8Array, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parsePng(buffer: Uint8Array) {
  if (buffer.length < 24) return undefined;
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!pngSignature.every((byte, index) => buffer[index] === byte)) return undefined;

  return {
    width: readUInt32BE(buffer, 16),
    height: readUInt32BE(buffer, 20),
  };
}

function parseJpeg(buffer: Uint8Array) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const size = readUInt16BE(buffer, offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: readUInt16BE(buffer, offset + 5),
        width: readUInt16BE(buffer, offset + 7),
      };
    }

    if (size < 2) break;
    offset += 2 + size;
  }

  return undefined;
}

function parseWebp(buffer: Uint8Array) {
  if (buffer.length < 30 || readAscii(buffer, 0, 4) !== "RIFF" || readAscii(buffer, 8, 12) !== "WEBP") {
    return undefined;
  }

  const chunkType = readAscii(buffer, 12, 16);

  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + readUIntLE3(buffer, 24),
      height: 1 + readUIntLE3(buffer, 27),
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: readUInt16LE(buffer, 26) & 0x3fff,
      height: readUInt16LE(buffer, 28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const bits = readUInt32LE(buffer, 21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return undefined;
}

export function parseImageMetadata(buffer: Uint8Array, mimeType: string): ParsedImageMetadata {
  const parsed =
    mimeType === "image/png"
      ? parsePng(buffer)
      : mimeType === "image/jpeg"
        ? parseJpeg(buffer)
        : mimeType === "image/webp"
          ? parseWebp(buffer)
          : undefined;

  if (!parsed || !parsed.width || !parsed.height) {
    throw new Error("Could not read image dimensions. Use PNG, JPEG, or WebP.");
  }

  return {
    ...parsed,
    orientation: orientationOf(parsed.width, parsed.height),
  };
}

function inferEnvironment(fileName: string, orientation: AssetOrientation, brightness: SceneAnalysis["brightness"]) {
  const lower = fileName.toLowerCase();

  if (/(room|bed|desk|kitchen|office|living|studio|home)/.test(lower)) return "indoor";
  if (/(street|park|beach|sky|garden|mountain|harbor|sea|road|city)/.test(lower)) return "outdoor";
  if (orientation === "landscape" && brightness === "bright") return "outdoor";
  if (orientation === "portrait" && brightness !== "bright") return "indoor";
  return "mixed";
}

export function buildSceneAnalysis({
  fileName,
  orientation,
  input,
}: {
  fileName: string;
  orientation: AssetOrientation;
  input?: UploadAnalysisInput;
}): SceneAnalysis {
  const brightness = input?.brightness ?? "balanced";
  const suggestedPlacement =
    input?.suggestedPlacement ?? (orientation === "landscape" ? "left" : "center");
  const environment = input?.environment ?? inferEnvironment(fileName, orientation, brightness);

  return {
    environment,
    brightness,
    orientation,
    suggestedPlacement,
    summary:
      input?.summary ??
      `${environment === "indoor" ? "Indoor" : environment === "outdoor" ? "Outdoor" : "Mixed indoor/outdoor"} / ${
        brightness === "bright" ? "Bright" : brightness === "moody" ? "Moody" : "Neutral"
      } / ${suggestedPlacement === "left" ? "Left placement recommended" : suggestedPlacement === "right" ? "Right placement recommended" : "Center placement recommended"}`,
  };
}

export function orientationFromSize(width: number, height: number) {
  return orientationOf(width, height);
}
