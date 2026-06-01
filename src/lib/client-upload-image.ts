"use client";

const DEFAULT_MAX_LONG_EDGE = 1536;
const DEFAULT_WEBP_QUALITY = 0.72;

export interface PreparedUploadImage {
  file: File;
  originalName: string;
  originalSize: number;
  optimizedSize: number;
  outputMimeType: string;
  width: number;
  height: number;
  wasOptimized: boolean;
}

function fileExtensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "img";
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  const index = fileName.lastIndexOf(".");
  if (index <= 0) {
    return `${fileName}.${nextExtension}`;
  }
  return `${fileName.slice(0, index)}.${nextExtension}`;
}

function createBlobFromCanvas(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  return new Promise<{ image: HTMLImageElement; revoke: () => void }>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({
        image,
        revoke: () => URL.revokeObjectURL(objectUrl),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load the image."));
    };
    image.src = objectUrl;
  });
}

export async function prepareImageForUpload(file: File): Promise<PreparedUploadImage> {
  const { image, revoke } = await loadImage(file);

  try {
    const scale = Math.min(1, DEFAULT_MAX_LONG_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("Could not start image compression.");
    }

    context.drawImage(image, 0, 0, width, height);

    const preferredMimeType = file.type === "image/png" ? "image/png" : "image/webp";
    const optimizedBlob =
      (await createBlobFromCanvas(canvas, preferredMimeType, DEFAULT_WEBP_QUALITY)) ??
      (await createBlobFromCanvas(canvas, file.type || "image/png", DEFAULT_WEBP_QUALITY));

    if (!optimizedBlob) {
      throw new Error("Failed to compress the image.");
    }

    const optimizedFile = new File(
      [optimizedBlob],
      replaceFileExtension(file.name || "uploaded-image", fileExtensionForMimeType(optimizedBlob.type || file.type)),
      {
        type: optimizedBlob.type || file.type || "image/webp",
        lastModified: file.lastModified,
      },
    );

    const shouldUseOptimized =
      width !== image.naturalWidth ||
      height !== image.naturalHeight ||
      optimizedFile.size < file.size;
    const selectedFile = shouldUseOptimized ? optimizedFile : file;

    return {
      file: selectedFile,
      originalName: file.name || "uploaded-image",
      originalSize: file.size,
      optimizedSize: selectedFile.size,
      outputMimeType: selectedFile.type || file.type || preferredMimeType,
      width: shouldUseOptimized ? width : image.naturalWidth,
      height: shouldUseOptimized ? height : image.naturalHeight,
      wasOptimized: shouldUseOptimized,
    };
  } finally {
    revoke();
  }
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
