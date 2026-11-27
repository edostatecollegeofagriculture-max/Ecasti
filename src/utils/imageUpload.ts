export interface ImageUploadOptions {
  maxDimension?: number;
  preserveTransparency?: boolean;
  quality?: number;
}

/**
 * Reads an image file and scales/compresses it to a compact Data URL suitable for JSON storage.
 * Preserves PNG transparency when requested (e.g., for logos, school stamps, and signatures).
 */
export function readImageFileAsDataUrl(
  file: File,
  options: ImageUploadOptions = {}
): Promise<string> {
  const { maxDimension = 960, preserveTransparency = false, quality = 0.85 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Empty image data.'));
        return;
      }

      // Skip canvas re-encoding for SVG files
      if (file.type === 'image/svg+xml') {
        resolve(result);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = preserveTransparency || file.type === 'image/png' || file.type === 'image/webp';
        const outputType = isPng && preserveTransparency ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputType, quality);
        resolve(dataUrl);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
