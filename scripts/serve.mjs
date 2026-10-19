import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT || 4173),
  host = process.env.HOST || '127.0.0.1';
try {
  await stat(path.join(root, 'index.html'));
} catch {
  console.error('先运行 npm run build，再启动静态站点。');
  process.exit(1);
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method ?? '')) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', `http://${host}`).pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (pathname.includes('\0') || pathname.includes('\\')) {
      res.writeHead(400);
      res.end();
      return;
    }
    const file = path.resolve(
      root,
      '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname),
    );
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': pathname.includes('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('这一页还没有放进站点。');
  }
});
server.listen(port, host, () => console.log(`http://${host}:${port}`));
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
