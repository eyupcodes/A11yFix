import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  handleCrawl,
  handleDiff,
  handleExport,
  handleHealth,
  handleRemediate,
  handleScan,
} from './handlers.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

export interface ServerOptions {
  readonly port?: number | undefined;
  readonly staticDir?: string | undefined;
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    req.on('error', (err) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

export function createServer(options: ServerOptions = {}): Server {
  const staticDir =
    options.staticDir ?? join(fileURLToPath(import.meta.url), '../../client');

  const server = createHttpServer((req, res) => {
    void (async () => {
      setCorsHeaders(res);

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      const rawUrl = req.url ?? '/';
      const [path] = rawUrl.split('?');

      // API routes
      if (path === '/api/health' && req.method === 'GET') {
        const response = handleHealth();
        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(response.body));
        return;
      }

      if (path === '/api/scan' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const response = await handleScan(body);
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(response.body));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'Malformed JSON payload.',
              code: 'BAD_JSON',
            }),
          );
        }
        return;
      }

      if (path === '/api/crawl' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const response = await handleCrawl(body);
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(response.body));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'Malformed JSON payload.',
              code: 'BAD_JSON',
            }),
          );
        }
        return;
      }

      if (path === '/api/export' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const response = handleExport(body);
          res.statusCode = response.status;
          res.setHeader('Content-Type', response.contentType);
          res.end(response.body);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'Malformed JSON payload.',
              code: 'BAD_JSON',
            }),
          );
        }
        return;
      }

      if (path === '/api/diff' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const response = handleDiff(body);
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(response.body));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'Malformed JSON payload.',
              code: 'BAD_JSON',
            }),
          );
        }
        return;
      }

      if (path === '/api/remediate' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const response = await handleRemediate(body);
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(response.body));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'Malformed JSON payload.',
              code: 'BAD_JSON',
            }),
          );
        }
        return;
      }

      // Static files in production
      if (req.method === 'GET' && staticDir) {
        const relativePath =
          path === '/'
            ? 'index.html'
            : (path?.replace(/^\//, '') ?? 'index.html');
        const filePath = join(staticDir, relativePath);

        try {
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            const content = await readFile(filePath);
            const ext = extname(filePath).toLowerCase();
            res.setHeader(
              'Content-Type',
              MIME_TYPES[ext] ?? 'application/octet-stream',
            );
            res.statusCode = 200;
            res.end(content);
            return;
          }
        } catch {
          // Fallback for SPA routing: serve index.html if file not found
          try {
            const indexPath = join(staticDir, 'index.html');
            const content = await readFile(indexPath);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.statusCode = 200;
            res.end(content);
            return;
          } catch {
            // No static build available
          }
        }
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }));
    })();
  });

  return server;
}

// Direct execution entry point
const isDirectRun =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('server.js') ||
    process.argv[1].endsWith('server.ts'));

if (isDirectRun) {
  const port = Number(process.env['PORT'] ?? '3001');
  const server = createServer({ port });
  server.listen(port, () => {
    console.log(`A11yFix Web API server listening on http://localhost:${port}`);
  });
}
