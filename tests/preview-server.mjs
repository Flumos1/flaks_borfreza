import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import handler from '../api/order.js';

// Local-only checkout QA: execute the real handler with isolated delivery stubs.
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = 'local-test';
process.env.TELEGRAM_CHAT_ID = 'local-test';
delete process.env.RESEND_API_KEY;
let failDelivery = false;
globalThis.fetch = async (url) => {
  if (!String(url).startsWith('https://api.telegram.org/botlocal-test/')) throw new Error('External requests are disabled in QA');
  return { ok: !failDelivery, status: 503, text: async () => 'Simulated provider failure' };
};

const root = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/__qa/failure' && req.method === 'POST') {
    failDelivery = url.searchParams.get('enabled') === '1';
    res.end('Local QA delivery mode updated');
    return;
  }
  if (url.pathname === '/api/order') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
      if (chunks.reduce((sum, part) => sum + part.length, 0) > 32768) { res.writeHead(413).end(); return; }
    }
    req.body = Buffer.concat(chunks).toString();
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    await handler(req, res);
    return;
  }
  try {
    let path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const data = await readFile(path);
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.listen(0, '127.0.0.1', () => console.log(`Local QA (simulated delivery): http://127.0.0.1:${server.address().port}`));
