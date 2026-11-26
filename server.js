// Central Família — servidor sem dependências (Node >= 18)
// Contas por código de acesso, painel do responsável, jogos de estudo, progresso e Fábrica de Jogos com IA.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'familia.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'jogos-enviados');
const PUBLIC_DIR = path.join(__dirname, 'public');
const BUILTIN_DIR = path.join(__dirname, 'jogos');
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const SESSION_DAYS = 180;
const THEMES = ['roxo', 'azul', 'verde', 'laranja', 'rosa', 'vermelho', 'amarelo', 'espaco'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

// ---------------------------------------------------------------- dados
const BUILTIN_GAMES = [
  { id: 'g-portugues', title: 'Missão Português do Samuel', subject: 'Português', emoji: '📖', kind: 'html', src: '/jogos/portugues.html',
    desc: 'Sílaba tônica, acentuação, carta, diário, fábulas, discurso direto e indireto e teatro.' },
  { id: 'g-matematica', title: 'Missão Matemática do Samuel', subject: 'Matemática', emoji: '🔢', kind: 'html', src: '/jogos/matematica.html',
    desc: 'Contas, problemas e desafios de Matemática.' },
  { id: 'g-ingles', title: 'Missão Inglês do Samuel', subject: 'Inglês', emoji: '🇬🇧', kind: 'html', src: '/jogos/ingles.html',
    desc: 'Vocabulário e frases em Inglês.' },
  { id: 'g-tabuada', title: 'Desafio da Tabuada', subject: 'Matemática', emoji: '✖️', kind: 'quiz', desc: 'Tabuada do 2 ao 9 com a conta armada de apoio.',
    quiz: { questions: [
      { type: 'multipla', q: 'Quanto é 3 × 4?', apoio: '  3\n× 4\n───\n  ?', options: ['7', '12', '14', '10'], answer: 1, dica: 'Some o 3 quatro vezes: 3 + 3 + 3 + 3.', explica: '3 × 4 = 12, porque 3 + 3 + 3 + 3 = 12.' },
      { type: 'multipla', q: 'Quanto é 5 × 6?', apoio: '  5\n× 6\n───\n  ?', options: ['30', '25', '35', '11'], answer: 0, dica: 'Conte de 5 em 5 seis vezes.', explica: '5, 10, 15, 20, 25, 30. Então 5 × 6 = 30.' },
      { type: 'digitar', q: 'Escreva o resultado de 7 × 2.', apoio: '  7\n× 2\n───\n  ?', accept: ['14', 'catorze', 'quatorze'], dica: 'É o dobro de 7.', explica: 'O dobro de 7 é 14.' },
      { type: 'vf', q: '8 × 3 é igual a 24.', answer: true, dica: '8 + 8 + 8.', explica: 'Verdadeiro! 8 + 8 + 8 = 24.' },
      { type: 'multipla', q: 'Quanto é 9 × 2?', apoio: '  9\n× 2\n───\n  ?', options: ['11', '16', '18', '19'], answer: 2, dica: 'É o dobro de 9.', explica: '9 + 9 = 18.' },
      { type: 'vf', q: '6 × 5 é igual a 35.', answer: false, dica: 'Conte de 5 em 5 seis vezes.', explica: 'Falso! 6 × 5 = 30.' },
      { type: 'digitar', q: 'Escreva o resultado de 4 × 4.', apoio: '  4\n× 4\n───\n  ?', accept: ['16', 'dezesseis'], dica: '4 + 4 + 4 + 4.', explica: '4 × 4 = 16.' },
      { type: 'multipla', q: 'Samuel tem 3 caixas com 5 lápis em cada. Quantos lápis ele tem?', apoio: '  5\n× 3\n───\n  ?', options: ['8', '15', '12', '53'], answer: 1, dica: 'São 3 grupos de 5.', explica: '3 × 5 = 15 lápis.' },
      { type: 'multipla', q: 'Quanto é 2 × 8?', apoio: '  8\n× 2\n───\n  ?', options: ['10', '28', '16', '18'], answer: 2, dica: 'É o dobro de 8.', explica: '8 + 8 = 16.' },
      { type: 'digitar', q: 'Escreva o resultado de 9 × 3.', apoio: '  9\n× 3\n───\n  ?', accept: ['27', 'vinte e sete'], dica: '9 + 9 + 9.', explica: '9 × 3 = 27.' }
    ] } }
];

function blankData() {
  return { version: 2, family: { name: 'Central Família' }, secret: crypto.randomBytes(32).toString('hex'),
    users: [], sessions: {}, games: BUILTIN_GAMES.map(g => ({ ...g, builtin: true, assign: 'all', hidden: false, createdAt: new Date().toISOString() })),
    progress: {} };
}

let data;
function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (d && d.version === 2) {
      // garante que jogos internos novos apareçam após atualizações
      for (const g of BUILTIN_GAMES) {
        const ex = d.games.find(x => x.id === g.id);
        if (!ex) d.games.push({ ...g, builtin: true, assign: 'all', hidden: false, createdAt: new Date().toISOString() });
        else if (ex.builtin) Object.assign(ex, { src: g.src, kind: g.kind, quiz: g.quiz || ex.quiz });
      }
      return d;
    }
  } catch {}
  return blankData();
}
data = loadData();

let saveTimer = null;
function save(now) {
  clearTimeout(saveTimer);
  const write = () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, DATA_FILE);
  };
  if (now) return write();
  saveTimer = setTimeout(() => { try { write(); } catch (e) { console.error('Erro ao salvar', e); } }, 300);
}
save(true);

// ---------------------------------------------------------------- segurança
const uid = (n = 9) => crypto.randomBytes(n).toString('base64url');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (s) => crypto.createHmac('sha256', data.secret).update(s).digest('hex');
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const WORDS = ['LEAO', 'TIGRE', 'PANDA', 'COALA', 'RAPOSA', 'SAPO', 'MACACO', 'BALEIA', 'POLVO', 'GIRAFA', 'ZEBRA', 'CORUJA', 'GOLFINHO', 'PINGUIM', 'URSO', 'COELHO', 'FOGUETE', 'ESTRELA', 'COMETA', 'DRAGAO'];
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newKidCode() {
  for (;;) {
    let s = '';
    const b = crypto.randomBytes(4);
    for (const x of b) s += CHARS[x % CHARS.length];
    const code = `${WORDS[crypto.randomInt(WORDS.length)]}-${s}`;
    const key = hmac(normCode(code));
    if (!data.users.some(u => u.codeKey === key)) return { code, key };
  }
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') };
}
function checkPassword(pw, rec) {
  const h = crypto.scryptSync(pw, rec.salt, 32);
  return crypto.timingSafeEqual(h, Buffer.from(rec.hash, 'hex'));
}

const attempts = new Map();
function ipOf(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function limited(req, max = 12, windowMs = 15 * 60 * 1000) {
  const ip = ipOf(req), now = Date.now();
  const a = attempts.get(ip) || { n: 0, reset: now + windowMs };
  if (now > a.reset) { a.n = 0; a.reset = now + windowMs; }
  a.n++; attempts.set(ip, a);
  return a.n > max;
}

function parseCookies(req) {
  const out = {};
  for (const p of String(req.headers.cookie || '').split(';')) {
    const i = p.indexOf('='); if (i < 0) continue;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}
function currentUser(req) {
  const tok = parseCookies(req).cf_s;
  if (!tok) return null;
  const s = data.sessions[sha(tok)];
  if (!s || s.exp < Date.now()) return null;
  const u = data.users.find(x => x.id === s.userId);
  if (!u || u.disabled) return null;
  return u;
}
function startSession(req, res, user) {
  const tok = uid(32);
  data.sessions[sha(tok)] = { userId: user.id, exp: Date.now() + SESSION_DAYS * 864e5 };
  // limpa sessões vencidas
  for (const [k, v] of Object.entries(data.sessions)) if (v.exp < Date.now()) delete data.sessions[k];
  user.lastLogin = new Date().toISOString();
  save();
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cf_s=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

// ---------------------------------------------------------------- utilidades
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJson(req, max = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error('Arquivo grande demais'), { status: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const clean = (s, n = 200) => String(s ?? '').trim().slice(0, n);
const isAdmin = (u) => u && u.role === 'admin';
const canCreate = (u) => u && (u.role === 'admin' || u.canCreate);
function publicUser(u) {
  return { id: u.id, name: u.name, avatar: u.avatar, role: u.role, canCreate: !!u.canCreate || u.role === 'admin',
    disabled: !!u.disabled, lastLogin: u.lastLogin || null, createdAt: u.createdAt, hasPassword: !!u.pwd,
    favorites: Array.isArray(u.favorites) ? u.favorites : [], theme: u.theme || 'roxo', grade: u.grade || '' };
}
function canSee(u, g) {
  if (isAdmin(u)) return true;
  if (g.hidden) return false;
  if (g.createdBy === u.id) return true;
  return g.assign === 'all' || (Array.isArray(g.assign) && g.assign.includes(u.id));
}
function gameSummary(g) {
  const { quiz, ...rest } = g;
  return { ...rest, count: quiz ? quiz.questions.length : null, createdByName: data.users.find(x => x.id === g.createdBy)?.name || null };
}
function starsOf(userId) {
  return Object.values(data.progress[userId] || {}).reduce((a, p) => a + (p.stars || 0), 0);
}

// ---------------------------------------------------------------- validação de quiz
function sanitizeQuiz(q) {
  const qs = Array.isArray(q?.questions) ? q.questions : [];
  const out = [];
  for (const x of qs.slice(0, 60)) {
    const type = ['multipla', 'vf', 'digitar'].includes(x.type) ? x.type : 'multipla';
    const apoio = String(x.apoio ?? '').replace(/^\s*\n/, '').replace(/\s+$/, '').slice(0, 400);
    const base = { type, q: clean(x.q, 600), apoio, dica: clean(x.dica, 300), explica: clean(x.explica, 500) };
    if (!base.q) continue;
    if (type === 'multipla') {
      const options = (Array.isArray(x.options) ? x.options : []).map(o => clean(o, 200)).filter(Boolean).slice(0, 6);
      const answer = Number.isInteger(x.answer) ? x.answer : 0;
      if (options.length < 2 || answer < 0 || answer >= options.length) continue;
      out.push({ ...base, options, answer });
    } else if (type === 'vf') {
      out.push({ ...base, answer: x.answer === true || x.answer === 'true' || x.answer === 'V' });
    } else {
      const accept = (Array.isArray(x.accept) ? x.accept : [x.accept]).map(a => clean(a, 120)).filter(Boolean).slice(0, 8);
      if (!accept.length) continue;
      out.push({ ...base, accept });
    }
  }
  return { questions: out };
}

// ---------------------------------------------------------------- IA (Fábrica de Jogos)
async function generateQuiz({ subject, grade, title, text, images, count, childName }) {
  const n = Math.min(Math.max(parseInt(count) || 10, 3), 25);
  const system = `Você cria jogos de estudo em português do Brasil para crianças. Responda SOMENTE com um JSON válido, sem texto antes ou depois.
Formato:
{"title": "título curto e divertido", "emoji": "um emoji", "desc": "uma frase sobre o jogo",
 "questions": [
  {"type":"multipla","q":"pergunta","options":["A","B","C","D"],"answer":0,"apoio":"","dica":"","explica":""},
  {"type":"vf","q":"afirmação","answer":true,"dica":"","explica":""},
  {"type":"digitar","q":"pergunta de resposta curta","accept":["resposta","variação aceita"],"dica":"","explica":""}
 ]}
Regras:
- Crie exatamente ${n} perguntas, baseadas SOMENTE no material enviado (texto e/ou fotos do caderno/livro). Cubra os principais pontos do material.
- Linguagem simples, carinhosa e adequada para a idade/série informada. Frases curtas.
- Misture os tipos (maioria "multipla"; alguns "vf" e "digitar"). Em "multipla", 3 ou 4 opções plausíveis e "answer" é o índice (0 a 3) da correta; varie a posição da correta.
- "dica" ajuda sem entregar a resposta. "explica" diz em 1 ou 2 frases por que a resposta está certa, de forma encorajadora.
- Em perguntas de conta (Matemática), preencha "apoio" com a conta armada em texto monoespaçado usando \\n para quebrar linhas (ex.: "  23\\n+ 15\\n────\\n   ?"; para divisão use a chave: " 84 |_4_\\n    | ?"), para a criança resolver no apoio.
- Em "digitar", aceite variações razoáveis (com e sem acento, número por extenso).
- Nada de conteúdo impróprio para crianças.`;
  const content = [];
  for (const img of (images || []).slice(0, 10)) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(img || '');
    if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  content.push({ type: 'text', text:
`Matéria: ${clean(subject, 60) || 'não informada'}
Ano/série ou idade: ${clean(grade, 60) || 'cerca de 8 anos (3º ano)'}
${childName ? `Nome da criança (pode usar nas frases): ${clean(childName, 40)}\n` : ''}Título sugerido: ${clean(title, 100) || '(crie um)'}
Material de estudo${content.length ? ' (veja também as fotos acima)' : ''}:
${clean(text, 20000) || '(somente as fotos)'}` });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 8000, system, messages: [{ role: 'user', content }] })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Erro da IA (${r.status})`), { status: 502 });
  const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  if (a < 0 || b < 0) throw Object.assign(new Error('A IA não devolveu um jogo válido. Tente de novo.'), { status: 502 });
  const parsed = JSON.parse(txt.slice(a, b + 1));
  const quiz = sanitizeQuiz(parsed);
  if (!quiz.questions.length) throw Object.assign(new Error('Não consegui montar perguntas com esse material.'), { status: 422 });
  return { title: clean(parsed.title, 100), emoji: clean(parsed.emoji, 8), desc: clean(parsed.desc, 200), quiz };
}

// ---------------------------------------------------------------- rotas
async function api(req, res, p, url) {
  const m = req.method;
  const me = currentUser(req);

  if (p === '/api/health') return send(res, 200, { ok: true });

  if (p === '/api/state' && m === 'GET') {
    return send(res, 200, { setupNeeded: !data.users.some(u => u.role === 'admin'), family: data.family,
      me: me ? publicUser(me) : null, ai: !!AI_KEY });
  }

  if (p === '/api/setup' && m === 'POST') {
    if (data.users.some(u => u.role === 'admin')) return send(res, 409, { error: 'A central já foi configurada.' });
    if (limited(req)) return send(res, 429, { error: 'Muitas tentativas. Espere alguns minutos.' });
    const b = await readJson(req);
    const name = clean(b.name, 40), pw = String(b.password || '');
    if (!name) return send(res, 400, { error: 'Informe seu nome.' });
    if (pw.length < 8) return send(res, 400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
    if (b.familyName) data.family.name = clean(b.familyName, 60);
    const u = { id: uid(), name, avatar: clean(b.avatar, 8) || '🦉', role: 'admin', canCreate: true, pwd: hashPassword(pw), createdAt: new Date().toISOString() };
    data.users.push(u);
    // jogos internos ficam “criados” pelo primeiro responsável
    startSession(req, res, u);
    save(true);
    return send(res, 200, { ok: true, me: publicUser(u) });
  }

  if (p === '/api/login' && m === 'POST') {
    if (limited(req)) return send(res, 429, { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
    const b = await readJson(req);
    const raw = String(b.code || '').trim();
    if (!raw) return send(res, 400, { error: 'Digite seu código.' });
    let user = null;
    const key = hmac(normCode(raw));
    user = data.users.find(u => u.codeKey && u.codeKey === key && !u.disabled);
    if (!user) for (const u of data.users) if (u.pwd && !u.disabled && checkPassword(raw, u.pwd)) { user = u; break; }
    if (!user) return send(res, 401, { error: 'Código não encontrado. Confira e tente de novo.' });
    startSession(req, res, user);
    return send(res, 200, { ok: true, me: publicUser(user) });
  }

  if (p === '/api/logout' && m === 'POST') {
    const tok = parseCookies(req).cf_s;
    if (tok) { delete data.sessions[sha(tok)]; save(); }
    res.setHeader('Set-Cookie', 'cf_s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return send(res, 200, { ok: true });
  }

  if (!me) return send(res, 401, { error: 'Faça login.' });

  // ---------- criança / qualquer usuário
  if (p === '/api/home' && m === 'GET') {
    const games = data.games.filter(g => canSee(me, g)).map(gameSummary);
    return send(res, 200, { me: publicUser(me), family: data.family, games, progress: data.progress[me.id] || {}, stars: starsOf(me.id), ai: !!AI_KEY });
  }

  let mm;
  if ((mm = /^\/api\/games\/([\w-]+)$/.exec(p)) && m === 'GET') {
    const g = data.games.find(x => x.id === mm[1]);
    if (!g || !canSee(me, g)) return send(res, 404, { error: 'Jogo não encontrado.' });
    return send(res, 200, { ...gameSummary(g), quiz: g.quiz || null });
  }

  if (p === '/api/progress' && m === 'POST') {
    const b = await readJson(req);
    const g = data.games.find(x => x.id === b.gameId);
    if (!g || !canSee(me, g)) return send(res, 404, { error: 'Jogo não encontrado.' });
    const P = (data.progress[me.id] ||= {});
    const r = (P[g.id] ||= { plays: 0, stars: 0, best: 0 });
    r.plays++; r.last = new Date().toISOString();
    if (Number.isFinite(b.total) && b.total > 0) {
      const pct = Math.round(Math.min(Math.max(b.score, 0), b.total) / b.total * 100);
      const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
      r.lastPct = pct; r.best = Math.max(r.best || 0, pct); r.stars = Math.max(r.stars || 0, stars);
      (r.history ||= []).push({ at: r.last, pct }); r.history = r.history.slice(-20);
    }
    save();
    return send(res, 200, { ok: true, record: r, stars: starsOf(me.id) });
  }

  if (p === '/api/me' && m === 'PATCH') {
    const b = await readJson(req);
    if (b.avatar) me.avatar = clean(b.avatar, 8);
    if (b.theme && THEMES.includes(b.theme)) me.theme = b.theme;
    if (Array.isArray(b.favorites)) me.favorites = [...new Set(b.favorites.filter(id => data.games.some(g => g.id === id && canSee(me, g))))].slice(0, 60);
    save();
    return send(res, 200, { ok: true, me: publicUser(me) });
  }

  // ---------- criar jogos (responsável ou quem tiver permissão)
  if (p === '/api/generate' && m === 'POST') {
    if (!canCreate(me)) return send(res, 403, { error: 'Sem permissão para criar jogos.' });
    if (!AI_KEY) return send(res, 400, { error: 'A geração automática ainda não está ligada. Configure ANTHROPIC_API_KEY no Railway.' });
    if (limited({ headers: { 'x-forwarded-for': 'gen:' + me.id }, socket: {} }, 30, 60 * 60 * 1000)) return send(res, 429, { error: 'Muitos jogos gerados nesta hora. Tente mais tarde.' });
    const b = await readJson(req, 25 * 1024 * 1024);
    const out = await generateQuiz(b);
    return send(res, 200, out);
  }

  if (p === '/api/games' && m === 'POST') {
    if (!canCreate(me)) return send(res, 403, { error: 'Sem permissão para criar jogos.' });
    const b = await readJson(req, 8 * 1024 * 1024);
    const g = { id: 'j-' + uid(6), title: clean(b.title, 100) || 'Novo jogo', subject: clean(b.subject, 40) || 'Outra', emoji: clean(b.emoji, 8) || '🎯',
      desc: clean(b.desc, 300), grade: clean(b.grade, 60), createdBy: me.id, createdAt: new Date().toISOString(), hidden: false,
      assign: isAdmin(me) ? normAssign(b.assign) : 'all' };
    if (b.kind === 'html') {
      if (!isAdmin(me)) return send(res, 403, { error: 'Só o responsável pode enviar jogos prontos.' });
      const html = String(b.html || '');
      if (!/<html|<body|<script|<div/i.test(html)) return send(res, 400, { error: 'Arquivo HTML inválido.' });
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, g.id + '.html'), html);
      Object.assign(g, { kind: 'html', src: `/jogos-enviados/${g.id}.html` });
    } else {
      const quiz = sanitizeQuiz(b.quiz);
      if (!quiz.questions.length) return send(res, 400, { error: 'Adicione pelo menos uma pergunta completa.' });
      Object.assign(g, { kind: 'quiz', quiz });
    }
    data.games.push(g); save();
    return send(res, 200, { ok: true, game: gameSummary(g) });
  }

  if ((mm = /^\/api\/games\/([\w-]+)$/.exec(p)) && (m === 'PATCH' || m === 'DELETE')) {
    const g = data.games.find(x => x.id === mm[1]);
    if (!g) return send(res, 404, { error: 'Jogo não encontrado.' });
    if (!isAdmin(me) && g.createdBy !== me.id) return send(res, 403, { error: 'Sem permissão.' });
    if (m === 'DELETE') {
      data.games = data.games.filter(x => x !== g);
      if (g.kind === 'html' && !g.builtin) try { fs.unlinkSync(path.join(UPLOAD_DIR, g.id + '.html')); } catch {}
      save(); return send(res, 200, { ok: true });
    }
    const b = await readJson(req, 8 * 1024 * 1024);
    for (const k of ['title', 'subject', 'emoji', 'desc', 'grade']) if (k in b) g[k] = clean(b[k], k === 'desc' ? 300 : 100);
    if ('hidden' in b && isAdmin(me)) g.hidden = !!b.hidden;
    if ('assign' in b && isAdmin(me)) g.assign = normAssign(b.assign);
    if (b.quiz && g.kind === 'quiz') {
      const quiz = sanitizeQuiz(b.quiz);
      if (!quiz.questions.length) return send(res, 400, { error: 'Adicione pelo menos uma pergunta completa.' });
      g.quiz = quiz;
    }
    g.updatedAt = new Date().toISOString(); save();
    return send(res, 200, { ok: true, game: gameSummary(g) });
  }

  // ---------- painel do responsável
  if (!isAdmin(me)) return send(res, 403, { error: 'Área do responsável.' });

  if (p === '/api/admin/overview' && m === 'GET') {
    return send(res, 200, { family: data.family, ai: !!AI_KEY, users: data.users.map(u => ({ ...publicUser(u), stars: starsOf(u.id) })),
      games: data.games.map(gameSummary), progress: data.progress });
  }

  if (p === '/api/admin/family' && m === 'PATCH') {
    const b = await readJson(req);
    if (b.name) data.family.name = clean(b.name, 60);
    save(); return send(res, 200, { ok: true, family: data.family });
  }

  if (p === '/api/admin/users' && m === 'POST') {
    const b = await readJson(req);
    const name = clean(b.name, 40);
    if (!name) return send(res, 400, { error: 'Informe o nome.' });
    const role = b.role === 'admin' ? 'admin' : 'aluno';
    const u = { id: uid(), name, avatar: clean(b.avatar, 8) || '🦁', role, canCreate: role === 'admin' || !!b.canCreate, grade: clean(b.grade, 60), createdAt: new Date().toISOString(), createdBy: me.id };
    const { code, key } = newKidCode();
    u.codeKey = key;
    data.users.push(u); save();
    return send(res, 200, { ok: true, user: publicUser(u), code });
  }

  if ((mm = /^\/api\/admin\/users\/([\w-]+)(\/code)?$/.exec(p))) {
    const u = data.users.find(x => x.id === mm[1]);
    if (!u) return send(res, 404, { error: 'Pessoa não encontrada.' });
    if (mm[2] && m === 'POST') {
      const { code, key } = newKidCode();
      u.codeKey = key;
      for (const [k, v] of Object.entries(data.sessions)) if (v.userId === u.id && u.id !== me.id) delete data.sessions[k];
      save(); return send(res, 200, { ok: true, code });
    }
    if (m === 'DELETE') {
      if (u.id === me.id) return send(res, 400, { error: 'Você não pode remover a si mesmo.' });
      data.users = data.users.filter(x => x !== u);
      delete data.progress[u.id];
      for (const [k, v] of Object.entries(data.sessions)) if (v.userId === u.id) delete data.sessions[k];
      for (const g of data.games) if (Array.isArray(g.assign)) g.assign = g.assign.filter(x => x !== u.id);
      save(); return send(res, 200, { ok: true });
    }
    if (m === 'PATCH') {
      const b = await readJson(req);
      if (b.name) u.name = clean(b.name, 40);
      if (b.avatar) u.avatar = clean(b.avatar, 8);
      if ('grade' in b) u.grade = clean(b.grade, 60);
      if ('canCreate' in b) u.canCreate = !!b.canCreate;
      if ('disabled' in b && u.id !== me.id) {
        u.disabled = !!b.disabled;
        if (u.disabled) for (const [k, v] of Object.entries(data.sessions)) if (v.userId === u.id) delete data.sessions[k];
      }
      if (b.role && u.id !== me.id) u.role = b.role === 'admin' ? 'admin' : 'aluno';
      if (u.role === 'admin') u.canCreate = true;
      if (b.password) {
        if (u.id !== me.id) return send(res, 403, { error: 'Cada responsável troca a própria senha.' });
        if (String(b.password).length < 8) return send(res, 400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
        u.pwd = hashPassword(String(b.password));
      }
      save(); return send(res, 200, { ok: true, user: publicUser(u) });
    }
  }

  return send(res, 404, { error: 'Não encontrado.' });
}
function normAssign(a) {
  if (Array.isArray(a)) return a.filter(id => data.users.some(u => u.id === id));
  return 'all';
}

function serveFile(res, file, extraHeaders = {}) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', ...extraHeaders });
  fs.createReadStream(file).pipe(res);
}
function inside(base, rel) {
  const f = path.normalize(path.join(base, rel));
  return f.startsWith(base + path.sep) ? f : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p.startsWith('/api/')) return await api(req, res, p, url);

    // jogos prontos: só para quem está logado e tem acesso
    let mm;
    if ((mm = /^\/(jogos|jogos-enviados)\/([\w.-]+\.html)$/.exec(p))) {
      const me = currentUser(req);
      if (!me) { res.writeHead(302, { Location: '/' }); return res.end(); }
      const src = `/${mm[1]}/${mm[2]}`;
      const g = data.games.find(x => x.src === src);
      if (!g || !canSee(me, g)) return send(res, 404, 'Jogo não encontrado', 'text/plain; charset=utf-8');
      const file = inside(mm[1] === 'jogos' ? BUILTIN_DIR : UPLOAD_DIR, mm[2]);
      return serveFile(res, file, { 'Cache-Control': 'no-store' });
    }

    const file = inside(PUBLIC_DIR, p === '/' ? 'index.html' : p.slice(1));
    if (file && fs.existsSync(file) && !fs.statSync(file).isDirectory()) return serveFile(res, file, { 'Cache-Control': 'no-cache' });
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), { 'Cache-Control': 'no-cache' });
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Algo deu errado. Tente de novo.' : e.message });
  }
});

server.listen(PORT, () => {
  console.log(`Central Família rodando na porta ${PORT}`);
  console.log(`Dados em: ${DATA_FILE}`);
  console.log(`IA para criar jogos: ${AI_KEY ? 'ligada (' + AI_MODEL + ')' : 'desligada (defina ANTHROPIC_API_KEY)'}`);
  if (!data.users.some(u => u.role === 'admin')) console.log('Primeiro acesso: abra o site e crie a conta do responsável.');
});

// desligamento limpo (Railway envia SIGTERM ao trocar de versão): grava dados pendentes e sai sem erro
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { save(true); } catch (e) { console.error('Erro ao salvar no desligamento', e); }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
