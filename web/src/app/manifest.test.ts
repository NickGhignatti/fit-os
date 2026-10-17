import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
