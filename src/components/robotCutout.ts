/**
 * Remove the prototype dashboard from the original RODEX animation frames.
 * This operates entirely in the browser. It preserves the actual approved
 * robot artwork (including the dark visor), not an approximation of it.
 *
 * The source frames share a fixed 414 x 231 composition. All dashboard,
 * captions and menus are outside the constrained character extraction zone.
 */
const IMAGE_WIDTH = 414;
const IMAGE_HEIGHT = 231;

export async function isolateRobotFrame(source: string): Promise<string> {
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  await new Promise<void>((resolve, reject) => {
    if (image.complete && image.naturalWidth) { resolve(); return; }
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to decode RODEX animation frame'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || IMAGE_WIDTH;
  canvas.height = image.naturalHeight || IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not supported');
  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = frame;
  const alpha = new Uint8ClampedArray(width * height);

  // Interior of the helmet contains a genuinely black visor. Keep it opaque:
  // identify the bright shell at each scanline, then fill its interior.
  const headBounds: Array<[number, number] | null> = new Array(height).fill(null);
  for (let y = 12; y <= Math.min(113, height - 1); y++) {
    let left = width;
    let right = -1;
    for (let x = 135; x <= Math.min(280, width - 1); x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 82 && g > 105 && b > 119) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    if (right >= left + 5) headBounds[y] = [left, right];
  }

  // Apply a feathered alpha mask using the character's shared frame bounds.
  for (let y = 8; y < Math.min(201, height); y++) {
    for (let x = 122; x < Math.min(291, width); x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const value = Math.max(r * .96, g * .92, b * .76);
      const head = headBounds[y];
      const intensity = head && x >= head[0] && x <= head[1]
        ? 1
        : Math.max(0, Math.min(1, (value - 36) / 74));
      const edge = Math.max(0, Math.min(1, (x - 122) / 5, (290 - x) / 5, (y - 8) / 5, (200 - y) / 5));
      alpha[y * width + x] = Math.round(255 * intensity * edge);
    }
  }

  // A gentle 3px antialias smooths WebP edges without obscuring the eyes.
  const soft = new Uint8ClampedArray(alpha.length);
  for (let y = 9; y < Math.min(200, height - 1); y++) {
    for (let x = 123; x < Math.min(290, width - 1); x++) {
      const i = y * width + x;
      const around = alpha[i - width] + alpha[i + width] + alpha[i - 1] + alpha[i + 1];
      soft[i] = Math.round(alpha[i] * .66 + (around / 4) * .34);
    }
  }

  for (let i = 0; i < soft.length; i++) data[i * 4 + 3] = soft[i];
  ctx.putImageData(frame, 0, 0);
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else resolve(canvas.toDataURL('image/png'));
    }, 'image/png');
  });
}
