import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, session } from 'electron';

export const DESKTOP_PARTITION = 'persist:monteskolar';

/** Serves only the bundled renderer, with a stable origin across installs/updates. */
export function registerAppProtocol(rendererDir: string): void {
  session.fromPartition(DESKTOP_PARTITION).protocol.handle('monteskolar', async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const url = new URL(request.url);
      if (url.hostname !== 'app' || url.username || url.password || url.port) {
        return new Response('Not found', { status: 404 });
      }

      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const filePath = path.resolve(rendererDir, `.${pathname}`);
      const relative = path.relative(rendererDir, filePath);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        return new Response('Not found', { status: 404 });
      }

      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
