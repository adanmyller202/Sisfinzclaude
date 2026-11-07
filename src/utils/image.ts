/**
 * Image processing utilities for Goal Photo & Puzzle
 * Resizes, respects EXIF orientation, and compresses down to ~380 KB max.
 */

export interface CompressedImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Compresses an image file to a JPEG data URL <= ~380 KB with max dimension 900px,
 * honoring EXIF orientation.
 */
export async function fileToCompressedDataUrl(file: File): Promise<CompressedImageResult> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Formato inválido. Por favor, envie um arquivo de imagem.');
  }

  const MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('A imagem deve ter no máximo 15 MB.');
  }

  // Load image with orientation support
  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawSource: CanvasImageSource;

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' as ImageOrientation });
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      drawSource = bitmap;
    } else {
      throw new Error('createImageBitmap not available');
    }
  } catch {
    // Fallback using HTMLImageElement
    drawSource = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Não foi possível carregar a imagem.'));
      };
      img.src = url;
    });
    sourceWidth = (drawSource as HTMLImageElement).naturalWidth || (drawSource as HTMLImageElement).width;
    sourceHeight = (drawSource as HTMLImageElement).naturalHeight || (drawSource as HTMLImageElement).height;
  }

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Dimensões da imagem inválidas.');
  }

  // Calculate scaled dimensions (max 900px on the longest side)
  const MAX_DIM = 900;
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.max(1, Math.round((sourceHeight * MAX_DIM) / sourceWidth));
      targetWidth = MAX_DIM;
    } else {
      targetWidth = Math.max(1, Math.round((sourceWidth * MAX_DIM) / sourceHeight));
      targetHeight = MAX_DIM;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem no navegador.');
  }

  ctx.drawImage(drawSource, 0, 0, targetWidth, targetHeight);

  // Close bitmap if applicable
  if ('close' in drawSource && typeof (drawSource as ImageBitmap).close === 'function') {
    (drawSource as ImageBitmap).close();
  }

  const MAX_TARGET_BYTES = 380 * 1024; // ~380 KB limit for Firestore doc field safety

  function estimateBytes(dataUrl: string): number {
    const head = dataUrl.indexOf(',');
    const base64Str = head !== -1 ? dataUrl.slice(head + 1) : dataUrl;
    return Math.round((base64Str.length * 3) / 4);
  }

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let bytes = estimateBytes(dataUrl);

  // If still above 380KB, step quality down to 0.5
  while (bytes > MAX_TARGET_BYTES && quality > 0.5) {
    quality = Math.max(0.5, quality - 0.08);
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    bytes = estimateBytes(dataUrl);
  }

  // If still above 380KB, downscale canvas dimensions
  while (bytes > MAX_TARGET_BYTES && (canvas.width > 240 || canvas.height > 240)) {
    const nextWidth = Math.max(180, Math.round(canvas.width * 0.82));
    const nextHeight = Math.max(180, Math.round(canvas.height * 0.82));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = nextWidth;
    tempCanvas.height = nextHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) break;
    tempCtx.drawImage(canvas, 0, 0, nextWidth, nextHeight);

    canvas.width = nextWidth;
    canvas.height = nextHeight;
    ctx.drawImage(tempCanvas, 0, 0, nextWidth, nextHeight);

    dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    bytes = estimateBytes(dataUrl);
  }

  if (bytes > MAX_TARGET_BYTES) {
    throw new Error('A imagem não pôde ser comprimida para o tamanho suportado (~380 KB). Por favor, escolha outra foto.');
  }

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}
