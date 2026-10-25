import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { APP_COLOR, manifest } from '../../pwa-manifest';

// Tests run from web/.
const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path));
const icons = manifest.icons ?? [];

/** Width and height from a PNG's header, so the test sees the real picture, not just its name. */
const pngSize = (file: Buffer): { width: number; height: number } | null => {
  const signature = file.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  return signature ? { width: file.readUInt32BE(16), height: file.readUInt32BE(20) } : null;
};

/**
 * The pixels of an 8-bit RGB or RGBA PNG (what the icons are), as [r, g, b, a]. Enough of the
 * format to look at the picture itself: an icon of the right size can still be blank.
 */
const pngPixels = (file: Buffer) => {
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const channels = file[25] === 6 ? 4 : 3;
  const parts: Buffer[] = [];
  for (let at = 8; at < file.length;) {
    const length = file.readUInt32BE(at);
    if (file.toString('ascii', at + 4, at + 8) === 'IDAT') parts.push(file.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]!;
      const left = i >= channels ? out[y * stride + i - channels]! : 0;
      const up = y > 0 ? out[(y - 1) * stride + i]! : 0;
      const upLeft = y > 0 && i >= channels ? out[(y - 1) * stride + i - channels]! : 0;
      const paeth = () => {
        const p = left + up - upLeft;
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      };
      const predicted = [0, left, up, (left + up) >> 1, paeth()][filter]!;
      out[y * stride + i] = (x + predicted) & 0xff;
    }
  }
  const pixel = (x: number, y: number): [number, number, number, number] => {
    const at = y * stride + x * channels;
    return [out[at]!, out[at + 1]!, out[at + 2]!, channels === 4 ? out[at + 3]! : 255];
  };
  return { width, height, pixel };
};

describe('installing as an app, not a bookmark', () => {
  it('declares a standalone app with a start page inside its scope', () => {
    expect(manifest.name).toBe('Tracker');
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe('standalone'); // no browser address bar
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url?.startsWith(manifest.scope!)).toBe(true);
    expect(manifest.id).toBeTruthy();
  });

  it('has PNG icons of exactly 192 and 512 pixels, which Android requires', () => {
    for (const size of [192, 512]) {
      const icon = icons.find((i) => i.sizes === `${size}x${size}` && i.type === 'image/png' && i.purpose === 'any');
      expect(icon, `a ${size}px "any" icon`).toBeDefined();
      expect(pngSize(read(`public${icon!.src}`))).toEqual({ width: size, height: size }); // the file really is that size
    }
  });

  it('has a maskable icon for Android\'s adaptive shapes', () => {
    const icon = icons.find((i) => i.purpose === 'maskable');
    expect(icon?.type).toBe('image/png');
    expect(pngSize(read(`public${icon!.src}`))).toEqual({ width: 512, height: 512 });
  });

  it('draws the logo in every PNG icon, not an empty or one-colour square', () => {
    for (const src of [...icons.filter((i) => i.type === 'image/png').map((i) => i.src), '/apple-touch-icon.png']) {
      const { width, height, pixel } = pngPixels(read(`public${src}`));
      let white = 0;
      let green = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const [r, g, b, a] = pixel(x, y);
          if (a > 200 && r > 230 && g > 230 && b > 230) white++; // the barbell
          if (a > 200 && g > 150 && r < 100 && b < 140) green++; // the ring
        }
      }
      expect(white / (width * height), `${src}: barbell`).toBeGreaterThan(0.03);
      expect(green / (width * height), `${src}: ring`).toBeGreaterThan(0.05);
    }
    // Android crops the maskable icon to its own shape, so it must be opaque right to the corners.
    const maskable = pngPixels(read(`public${icons.find((i) => i.purpose === 'maskable')!.src}`));
    expect(maskable.pixel(0, 0)[3]).toBe(255);
  });

  it('points every icon at a file that exists', () => {
    for (const icon of icons) expect(() => read(`public${icon.src}`), icon.src).not.toThrow();
  });

  it('gives iPhones a PNG touch icon (they ignore SVG)', () => {
    const html = read('index.html').toString();
    const href = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html)?.[1];
    expect(href).toBe('/apple-touch-icon.png');
    expect(pngSize(read(`public${href}`))).toEqual({ width: 180, height: 180 });
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="mobile-web-app-capable" content="yes"');
  });

  it('uses the app\'s own light colour for the status bar and splash, not a dark one', () => {
    const html = read('index.html').toString();
    const css = read('src/app/styles.css').toString();
    expect(manifest.theme_color).toBe(APP_COLOR);
    expect(manifest.background_color).toBe(APP_COLOR);
    expect(html).toContain(`<meta name="theme-color" content="${APP_COLOR}"`);
    expect(css).toContain(`--canvas: ${APP_COLOR}`);
  });

  it('is what the build actually uses, with the icons precached for offline', () => {
    const config = read('vite.config.ts').toString();
    expect(config).toMatch(/^\s*manifest,\s*$/m);
    expect(config).toContain('png');
  });
});
