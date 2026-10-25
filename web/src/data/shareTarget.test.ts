import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { manifest } from '../../pwa-manifest';

// Tests run from web/.
const script = readFileSync(join(process.cwd(), 'public', 'share-target.js'), 'utf8');

/** Runs public/share-target.js as the service worker would, with an in-memory cache. */
const serviceWorker = () => {
  const listeners: ((event: unknown) => void)[] = [];
  const stored = new Map<string, Response>();
  const caches = { open: async () => ({ put: async (key: string, response: Response) => { stored.set(key, response); } }) };
  new Function('self', 'caches', script)({ addEventListener: (_type: string, listener: (event: unknown) => void) => listeners.push(listener) }, caches);
  const dispatch = async (request: Request): Promise<Response | null> => {
    let answer: Promise<Response> | null = null;
    for (const listener of listeners) listener({ request, respondWith: (r: Promise<Response>) => { answer = r; } });
    return answer;
  };
  return { dispatch, stored };
};

describe('files shared to the installed app', () => {
  it('appear in Android\'s share sheet for the files Tracker writes', () => {
    const target = manifest.share_target!;
    expect(target).toMatchObject({ action: '/share-target', method: 'POST', enctype: 'multipart/form-data' });
    const [files] = [target.params.files].flat();
    expect(files).toMatchObject({ name: 'file' });
    expect(files!.accept).toContain('application/json');
  });

  it('are kept for the app, which is then opened on /import', async () => {
    const { dispatch, stored } = serviceWorker();
    const form = new FormData();
    form.append('file', new File(['{"v":1}'], 'strength plan.fitos.json', { type: 'application/json' }));
    const response = await dispatch(new Request('https://tracker.example/share-target', { method: 'POST', body: form }));
    expect(response!.status).toBe(303);
    expect(response!.headers.get('location')).toBe('https://tracker.example/import');
    const kept = stored.get('/shared-file')!;
    expect(await kept.text()).toBe('{"v":1}');
    expect(decodeURIComponent(kept.headers.get('x-file-name')!)).toBe('strength plan.fitos.json');
  });

  it('leave every other request to the rest of the service worker', async () => {
    const { dispatch } = serviceWorker();
    expect(await dispatch(new Request('https://tracker.example/workouts'))).toBeNull();
    expect(await dispatch(new Request('https://tracker.example/share-target'))).toBeNull(); // a GET
  });
});
