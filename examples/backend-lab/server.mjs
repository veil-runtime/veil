import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const host = '127.0.0.1', port = Number(process.env.PORT || 4180), seed = [
  { id: 'INC-104', title: 'Checkout latency', status: 'Investigating' },
  { id: 'INC-103', title: 'Queue backlog', status: 'Monitoring' },
  { id: 'INC-102', title: 'Cache refresh', status: 'Resolved' },
];
const sessions = new Map();
const siteRoot = resolve(process.env.SITE_ROOT || 'dist');
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(res, 403, { error: 'Origin rejected' });
  if (url.pathname === '/api/session' && req.method === 'POST') {
    const id = randomBytes(24).toString('base64url'); sessions.set(id, structuredClone(seed));
    res.writeHead(200, { 'set-cookie': `lab_session=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=3600`, 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end('{"ok":true}');
  }
  if (url.pathname === '/api/records' && req.method === 'GET') {
    const id = (req.headers.cookie || '').match(/(?:^|; )lab_session=([A-Za-z0-9_-]{20,80})(?:;|$)/)?.[1];
    const records = id && sessions.get(id);
    if (!records) return json(res, 401, { error: 'Start a demo session before loading records.' });
    const q = (url.searchParams.get('q') || '').slice(0, 80).toLowerCase();
    await new Promise(resolve => setTimeout(resolve, Math.min(700, Number(url.searchParams.get('delay') || 180))));
    return json(res, 200, { records: records.filter(r => `${r.id} ${r.title} ${r.status}`.toLowerCase().includes(q)) });
  }
  if (url.pathname === '/api/records' && req.method === 'POST') {
    const cookie = req.headers.cookie || '', id = cookie.match(/(?:^|; )lab_session=([A-Za-z0-9_-]{20,80})(?:;|$)/)?.[1];
    const records = id && sessions.get(id);
    if (!records) return json(res, 401, { error: 'Start a demo session before submitting.' });
    let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) return json(res, 413, { error: 'Request too large.' }); }
    let input; try { input = JSON.parse(raw); } catch { return json(res, 400, { error: 'Invalid JSON.' }); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['title', 'detail'].includes(key))) return json(res, 400, { error: 'Unsupported request fields.' });
    if (typeof input.title !== 'string' || input.title.trim().length < 4 || input.title.length > 80 || typeof input.detail !== 'string' || input.detail.trim().length < 8 || input.detail.length > 500) return json(res, 422, { error: 'Title must be 4–80 characters and detail 8–500 characters.' });
    const record = { id: `INC-${105 + records.length - 3}`, title: input.title.trim(), status: 'Submitted' }; records.unshift(record);
    return json(res, 201, { record });
  }
  if (req.method === 'GET') {
    const relative = decodeURIComponent(url.pathname.replace(/^\/veil\/?/, '')).replace(/^\/+/, '');
    const file = resolve(siteRoot, relative || 'index.html');
    if (file !== siteRoot && !file.startsWith(siteRoot + sep)) return json(res, 404, { error: 'Route not found.' });
    try {
      const served = url.pathname.endsWith('/') || file.endsWith(sep) ? resolve(file, 'index.html') : file;
      const body = await readFile(served);
      const type = ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json' })[extname(served)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control':'no-store' }); return res.end(body);
    } catch { return json(res, 404, { error: 'File not found.' }); }
  }
  return json(res, 404, { error: 'Route not found.' });
});
server.listen(port, host, () => console.log(`Backend Lab demo listening on http://${host}:${port}`));
