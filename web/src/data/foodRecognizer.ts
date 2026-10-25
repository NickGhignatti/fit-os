import type { InferenceSession } from 'onnxruntime-web';
import type { Recognition, RecogniserModel } from '../domain/photoFoods';

/** Recognises the foods in a photo, on the device: the photo never leaves it. */
export interface FoodRecognizer {
  /**
   * Looks at [photo]. The first time, the recogniser (about 25 MB) is downloaded, and
   * [onProgress] hears how far along it is, 0 to 1; later it comes from the browser's cache.
   */
  recognize(photo: Blob, onProgress?: (done: number) => void): Promise<{ model: RecogniserModel; recognition: Recognition }>;
}

const MODEL = '/models/food-recognizer.onnx';
const CLASSES = '/models/food-classes.json';

/** Downloads [url], reporting progress when the server says how big it is. */
const download = async (url: string, onProgress: (done: number) => void): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`could not download ${url}: ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress(Math.min(received / total, 1));
  }
  const bytes = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes.buffer;
};

/** The photo squeezed to size x size, nothing cropped, as 0..1 RGB planes: what the recogniser was trained on. */
const pixelsOf = async (photo: Blob, size: number): Promise<Float32Array> => {
  const bitmap = await createImageBitmap(photo);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  const rgba = context.getImageData(0, 0, size, size).data;
  const plane = size * size;
  const pixels = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    pixels[i] = rgba[i * 4]! / 255;
    pixels[plane + i] = rgba[i * 4 + 1]! / 255;
    pixels[2 * plane + i] = rgba[i * 4 + 2]! / 255;
  }
  return pixels;
};

/** The recogniser of tools/food-model, run by ONNX Runtime's WebAssembly engine. Loaded on first use. */
export class OnnxFoodRecognizer implements FoodRecognizer {
  private loading: Promise<{ model: RecogniserModel; session: InferenceSession; ort: typeof import('onnxruntime-web') }> | null = null;
  private progress: ((done: number) => void) | undefined;

  async recognize(photo: Blob, onProgress?: (done: number) => void) {
    this.progress = onProgress;
    const { model, session, ort } = await this.load();
    const pixels = await pixelsOf(photo, model.size);
    const output = await session.run({ pixels: new ort.Tensor('float32', pixels, [1, 3, model.size, model.size]) });
    return {
      model,
      recognition: { likelihoods: output.foods!.data as Float32Array, patches: output.patches!.data as Float32Array },
    };
  }

  private load() {
    this.loading ??= (async () => {
      const [ort, { default: wasm }] = await Promise.all([
        import('onnxruntime-web/wasm'),
        import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url'),
      ]);
      ort.env.wasm.wasmPaths = { wasm };
      const response = await fetch(CLASSES);
      if (!response.ok) throw new Error(`could not download ${CLASSES}: ${response.status}`);
      const model = (await response.json()) as RecogniserModel & { version: number };
      // The version in the address makes a retrained model replace the cached one.
      const bytes = await download(`${MODEL}?v=${model.version}`, (done) => this.progress?.(done));
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      return { model, session, ort };
    })().catch((error: unknown) => {
      this.loading = null; // try again next time, e.g. once back online
      throw error;
    });
    return this.loading;
  }
}
