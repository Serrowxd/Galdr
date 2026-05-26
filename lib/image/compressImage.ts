/**
 * Client-side image compression. If a file is already within `maxBytes` it is
 * returned untouched; otherwise it's decoded, optionally downscaled, and
 * re-encoded (WebP) at decreasing quality until it fits under the cap.
 *
 * Browser-only: relies on createImageBitmap / <canvas>. Animated GIFs are
 * flattened to their first frame.
 */

const MAX_DIMENSION = 1024;
const OUTPUT_TYPE = "image/webp";
const MIN_QUALITY = 0.4;
const MIN_DIMENSION = 256;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed."))),
      type,
      quality,
    );
  });
}

function draw(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base}.${ext}`;
}

/**
 * Returns a File no larger than `maxBytes` when possible. Throws only if the
 * browser can't decode/encode the image; if it still can't get under the cap
 * after exhausting quality and size reductions, it returns the smallest result
 * (the caller should re-check `.size`).
 */
export async function compressImageToMax(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  try {
    let width = bitmap.width;
    let height = bitmap.height;

    // Initial downscale so very large source dimensions don't dominate size.
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    let canvas = draw(bitmap, width, height);
    let quality = 0.9;
    let blob = await canvasToBlob(canvas, OUTPUT_TYPE, quality);

    // Step 1: drop quality.
    while (blob.size > maxBytes && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
      blob = await canvasToBlob(canvas, OUTPUT_TYPE, quality);
    }

    // Step 2: if still too big, shrink dimensions and retry at a fixed quality.
    while (blob.size > maxBytes && Math.max(width, height) > MIN_DIMENSION) {
      width = Math.max(MIN_DIMENSION, Math.round(width * 0.85));
      height = Math.max(MIN_DIMENSION, Math.round(height * 0.85));
      canvas = draw(bitmap, width, height);
      blob = await canvasToBlob(canvas, OUTPUT_TYPE, 0.8);
    }

    return new File([blob], withExtension(file.name, "webp"), { type: OUTPUT_TYPE });
  } finally {
    bitmap.close();
  }
}
