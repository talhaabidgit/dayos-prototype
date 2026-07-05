import { ResizeSettings, QualitySettings, EnhanceSettings } from './types';

function loadImage(src: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = src instanceof File || src instanceof Blob
      ? URL.createObjectURL(src)
      : src;
    img.onload = () => {
      if (src instanceof File || src instanceof Blob) {
        // Don't revoke yet — caller handles it
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export async function resizeImage(
  source: string | File | Blob,
  settings: ResizeSettings
): Promise<Blob> {
  const img = await loadImage(source);

  let targetW: number;
  let targetH: number;

  if (settings.mode === 'template') {
    const { SIZE_TEMPLATES } = await import('./types');
    const tmpl = SIZE_TEMPLATES.find(t => t.name === settings.templateId);
    if (!tmpl) throw new Error('Template not found');
    targetW = tmpl.width;
    targetH = tmpl.height;
  } else {
    targetW = settings.customWidth;
    targetH = settings.customHeight;
  }

  if (settings.maintainAspectRatio && settings.mode === 'custom') {
    const ratio = Math.min(targetW / img.width, targetH / img.height);
    if (settings.fitMode === 'cover') {
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const cw = img.width * scale;
      const ch = img.height * scale;
      const [canvas, ctx] = createCanvas(targetW, targetH);
      ctx.drawImage(img, (targetW - cw) / 2, (targetH - ch) / 2, cw, ch);
      return canvasToBlob(canvas, 'image/png');
    }
    targetW = Math.round(img.width * ratio);
    targetH = Math.round(img.height * ratio);
    const [canvas, ctx] = createCanvas(targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvasToBlob(canvas, 'image/png');
  }

  if (settings.fitMode === 'cover') {
    const scale = Math.max(targetW / img.width, targetH / img.height);
    const cw = img.width * scale;
    const ch = img.height * scale;
    const [canvas, ctx] = createCanvas(targetW, targetH);
    ctx.drawImage(img, (targetW - cw) / 2, (targetH - ch) / 2, cw, ch);
    return canvasToBlob(canvas, 'image/png');
  }

  if (settings.fitMode === 'contain') {
    const scale = Math.min(targetW / img.width, targetH / img.height);
    const dw = Math.round(img.width * scale);
    const dh = Math.round(img.height * scale);
    const [canvas, ctx] = createCanvas(targetW, targetH);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
    return canvasToBlob(canvas, 'image/png');
  }

  // stretch
  const [canvas, ctx] = createCanvas(targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvasToBlob(canvas, 'image/png');
}

export async function decreaseQuality(
  source: string | File | Blob,
  settings: QualitySettings
): Promise<Blob> {
  const img = await loadImage(source);
  let w = img.width;
  let h = img.height;

  if (settings.maxDimension && (w > settings.maxDimension || h > settings.maxDimension)) {
    const scale = Math.min(settings.maxDimension / w, settings.maxDimension / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const [canvas, ctx] = createCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const mimeType = settings.outputFormat === 'jpeg' ? 'image/jpeg'
    : settings.outputFormat === 'webp' ? 'image/webp'
    : 'image/png';

  const quality = settings.outputFormat === 'png' ? undefined : settings.quality / 100;
  return canvasToBlob(canvas, mimeType, quality);
}

export async function enhanceImage(
  source: string | File | Blob,
  settings: EnhanceSettings
): Promise<Blob> {
  const img = await loadImage(source);
  const [canvas, ctx] = createCanvas(img.width, img.height);

  // Build CSS filter string for brightness, contrast, saturation
  const brightness = 1 + settings.brightness / 100;
  const contrast = 1 + settings.contrast / 100;
  const saturate = 1 + settings.saturation / 100;
  ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';

  // Apply sharpening if needed
  if (settings.sharpness > 0) {
    applySharpen(ctx, img.width, img.height, settings.sharpness / 100);
  }

  return canvasToBlob(canvas, 'image/png');
}

function applySharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Simple unsharp mask via convolution
  const kernel = [
    0, -1 * amount, 0,
    -1 * amount, 1 + 4 * amount, -1 * amount,
    0, -1 * amount, 0,
  ];

  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            val += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        data[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, val));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      quality
    );
  });
}

export function blobToPreview(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    resolve(url);
  });
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getMimeTypeExt(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/webp': return 'webp';
    case 'image/png': return 'png';
    default: return 'png';
  }
}