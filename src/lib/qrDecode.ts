import jsQR from 'jsqr';

/**
 * 将 File 加载为 HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * 在指定尺寸下尝试用 jsQR 解析二维码
 */
function tryDecodeAtSize(
  img: HTMLImageElement,
  targetWidth: number
): string | null {
  const scale = targetWidth / img.width;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return code?.data || null;
  } catch {
    return null;
  }
}

/**
 * 从图片文件解析二维码内容。
 * 会在多个缩放尺寸下尝试，提高对模糊/倾斜/光照不均照片的识别率。
 */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const img = await loadImage(file);
  // 原始尺寸 + 多个降采样尺寸依次尝试
  const sizes = [img.width, 1200, 900, 700, 500, 400];
  const tried = new Set<number>();
  for (const s of sizes) {
    if (tried.has(s)) continue;
    tried.add(s);
    const result = tryDecodeAtSize(img, s);
    if (result) return result;
  }
  return null;
}