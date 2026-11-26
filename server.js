// Central Rodolpho — servidor sem dependências (Node >= 18)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'central.json');
const PASSWORD = process.env.CENTRAL_PASSWORD || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 2 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

// ---------- dados ----------
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'default-data.json'), 'utf8'));
  }
}
function saveData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- autenticação simples por senha ----------
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
function authorized(req) {
  if (!PASSWORD) return true;
  const key = req.headers['x-central-key'] || '';
  return crypto.timingSafeEqual(hash(key), hash(PASSWORD));
}

// ---------- utilidades ----------
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Verifica se um site responde e se permite ser aberto dentro da central (iframe)
async function checkUrl(url) {
  const started = Date.now();
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('protocolo');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctrl.signal,
      headers: { 'User-Agent': 'CentralRodolpho/1.0' } });
    clearTimeout(t);
    try { r.body && r.body.cancel(); } catch {}
    const xfo = (r.headers.get('x-frame-options') || '').toLowerCase();
    const csp = (r.headers.get('content-security-policy') || '').toLowerCase();
    const fa = /frame-ancestors([^;]*)/.exec(csp);
    const embeddable = !xfo && !(fa && !/\*/.test(fa[1]));
    return { url, ok: r.status < 500, status: r.status, ms: Date.now() - started, embeddable };
  } catch (e) {
    return { url, ok: false, status: 0, ms: Date.now() - started, embeddable: false, error: String(e.message || e) };
  }
}

// ---------- servidor ----------
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');

  try {
    if (pathname === '/api/health') return send(res, 200, { ok: true });
    if (pathname === '/api/config') return send(res, 200, { protected: !!PASSWORD });

    if (pathname.startsWith('/api/')) {
      if (!authorized(req)) return send(res, 401, { error: 'senha incorreta' });

      if (pathname === '/api/data' && req.method === 'GET') return send(res, 200, loadData());

      if (pathname === '/api/data' && req.method === 'PUT') {
        const data = JSON.parse(await readBody(req));
        if (!data || !Array.isArray(data.links)) return send(res, 400, { error: 'formato inválido' });
        data.updatedAt = new Date().toISOString();
        saveData(data);
        return send(res, 200, { ok: true, updatedAt: data.updatedAt });
      }

      if (pathname === '/api/check' && req.method === 'POST') {
        const { urls } = JSON.parse(await readBody(req));
        const list = (Array.isArray(urls) ? urls : []).filter(Boolean).slice(0, 60);
        const results = await Promise.all(list.map(checkUrl));
        return send(res, 200, { results });
      }
      return send(res, 404, { error: 'não encontrado' });
    }

    // arquivos estáticos
    let file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
    if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'proibido', 'text/plain');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { error: 'erro interno', detail: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`Central rodando na porta ${PORT}${PASSWORD ? ' (protegida por senha)' : ' (SEM senha)'}`);
  console.log(`Dados em: ${DATA_FILE}`);
});
