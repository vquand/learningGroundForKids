const BACKDROP_EDGE_DISTANCE = 20;
const BACKDROP_MAX_DISTANCE = 90;

/** Remove a flat, edge-connected illustration backdrop without erasing enclosed details. */
export function removeAvatarBackdrop(source: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(source);
  if (width < 1 || height < 1) return result;

  const background: [number, number, number] = [source[0] ?? 0, source[1] ?? 0, source[2] ?? 0];
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function visit(index: number) {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const originalAlpha = source[offset + 3] ?? 0;
    if (originalAlpha === 0) return;
    const distance = Math.max(
      Math.abs((source[offset] ?? 0) - background[0]),
      Math.abs((source[offset + 1] ?? 0) - background[1]),
      Math.abs((source[offset + 2] ?? 0) - background[2]),
    );
    if (distance >= BACKDROP_MAX_DISTANCE) return;

    const opacity = distance <= BACKDROP_EDGE_DISTANCE
      ? 0
      : (distance - BACKDROP_EDGE_DISTANCE) / (BACKDROP_MAX_DISTANCE - BACKDROP_EDGE_DISTANCE);
    result[offset + 3] = Math.round(originalAlpha * opacity);
    if (opacity > 0) {
      for (let channel = 0; channel < 3; channel += 1) {
        result[offset + channel] = Math.max(0, Math.min(255,
          ((source[offset + channel] ?? 0) - (background[channel] ?? 0) * (1 - opacity)) / opacity,
        ));
      }
    }
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x += 1) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    visit(y * width);
    visit(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++]!;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y + 1 < height) visit(index + width);
  }

  return result;
}

const transparentAvatarCache = new Map<string, Promise<string>>();

export function transparentKidAvatarSource(source: string): Promise<string> {
  const cached = transparentAvatarCache.get(source);
  if (cached) return cached;

  const generated = new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        imageData.data.set(removeAvatarBackdrop(imageData.data, canvas.width, canvas.height));
        context.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("Could not load avatar image"));
    image.src = source;
  });
  transparentAvatarCache.set(source, generated);
  void generated.catch(() => transparentAvatarCache.delete(source));
  return generated;
}
