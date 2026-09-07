import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {RoomStore} from './server/rooms.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const json = (res, status, body) => { res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };
async function readBody(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) throw Error('Request too large.'); }
  return JSON.parse(body || '{}');
}
export function createServer(store = new RoomStore()) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return json(res, 403, {error:'Use the same server for the game and API.'});
        if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return json(res, 415, {error:'JSON required.'});
        if (url.pathname === '/api/rooms' && req.method === 'POST') {
          const body = await readBody(req);
          return json(res, 201, store.create(body.config, body.name));
        }
        const match = url.pathname.match(/^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|commands))?$/);
        if (!match) return json(res, 404, {error:'Unknown endpoint.'});
        const [, code, operation] = match;
        if (operation === 'join' && req.method === 'POST') return json(res, 200, store.join(code, (await readBody(req)).name));
        const {room, player} = store.authenticate(code, req.headers.authorization?.replace(/^Bearer /, ''));
        if (!operation && req.method === 'GET') return json(res, 200, store.view(room, player));
        if (operation === 'commands' && req.method === 'POST') return json(res, 200, store.command(room, player, await readBody(req)));
        return json(res, 405, {error:'Method not allowed.'});
      }
      const pathname = decodeURIComponent(url.pathname);
      if (!['GET','HEAD'].includes(req.method) || !(pathname === '/' || pathname === '/index.html' || /^\/src\/[\w-]+\.(js|css)$/.test(pathname))) { res.writeHead(404); return res.end('Not found'); }
      const file = path.join(root, pathname === '/' ? 'index.html' : pathname.slice(1));
      const data = await readFile(file);
      res.setHeader('Content-Type', ({'.html':'text/html', '.js':'text/javascript', '.css':'text/css'})[path.extname(file)]);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (req.url.startsWith('/api/')) json(res, error.status || 400, {error:error.message || 'Invalid request.'});
      else { res.writeHead(404); res.end('Not found'); }
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => console.log(`Fleet Command: http://${host}:${port}`));
}
