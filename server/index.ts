export {};

type NodeRequest = any;
type NodeResponse = any;

type UserRole = 'admin' | 'user';

interface SessionUser {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  active: number;
  created_at: string;
}

interface CatalogSeed {
  name: string;
  slug: string;
  source: string;
  sourceUrl: string;
  creator: string;
  imageUrl: string;
  model: string;
  tags: string[];
  popularity: number;
}

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'skin-control.sqlite');
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const configuredPort = Number(process.env.PORT);
const PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 8000;

function loadEnvFile(): void {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile();
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    creator TEXT NOT NULL,
    image_url TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'wide',
    tags TEXT NOT NULL DEFAULT '[]',
    popularity INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

authenticateDatabase();

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authenticateDatabase(): void {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('accountadmin') as { id: number } | undefined;
  if (existing) return;
  const password = process.env.ADMIN_PASSWORD || 'accountadmin';
  db.prepare(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')`)
    .run('accountadmin', process.env.ADMIN_EMAIL || null, hashPassword(password));
  console.log(`Admin iniziale creato nel database: accountadmin (password da ADMIN_PASSWORD oppure accountadmin in locale)`);
}

const catalogSeeds: CatalogSeed[] = [
  {
    name: 'Mikeskin', slug: 'planet-minecraft-mikeskin', source: 'Planet Minecraft',
    sourceUrl: 'https://www.planetminecraft.com/skin/mikeskin/', creator: 'Brambolinie',
    imageUrl: 'https://mineskin.eu/body/Mikeskin/240.png', model: 'wide', tags: ['classic', 'planet minecraft'], popularity: 111,
  },
  {
    name: 'koakumaris', slug: 'namemc-koakumaris', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/koakumaris', creator: 'koakumaris',
    imageUrl: 'https://mineskin.eu/body/koakumaris/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 1398,
  },
  {
    name: 'yibbu', slug: 'namemc-yibbu', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/yibbu', creator: 'yibbu',
    imageUrl: 'https://mineskin.eu/body/yibbu/240.png', model: 'slim', tags: ['trending', 'community'], popularity: 214,
  },
  {
    name: 'undespairing', slug: 'namemc-undespairing', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/undespairing', creator: 'undespairing',
    imageUrl: 'https://mineskin.eu/body/undespairing/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 882,
  },
  {
    name: 'nx9_msmc_nzh', slug: 'namemc-nx9-msmc-nzh', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/nx9_msmc_nzh', creator: 'nx9_msmc_nzh',
    imageUrl: 'https://mineskin.eu/body/nx9_msmc_nzh/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 476,
  },
  {
    name: 'manyero', slug: 'namemc-manyero', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/manyero', creator: 'manyero',
    imageUrl: 'https://mineskin.eu/body/manyero/240.png', model: 'slim', tags: ['trending', 'community'], popularity: 159,
  },
  {
    name: 'Nospu', slug: 'namemc-nospu', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/Nospu', creator: 'Nospu',
    imageUrl: 'https://mineskin.eu/body/Nospu/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 265,
  },
  {
    name: 'yeowun', slug: 'namemc-yeowun', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/yeowun', creator: 'yeowun',
    imageUrl: 'https://mineskin.eu/body/yeowun/240.png', model: 'slim', tags: ['trending', 'community'], popularity: 69,
  },
  {
    name: '4alex_', slug: 'namemc-4alex', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/4alex_', creator: '4alex_',
    imageUrl: 'https://mineskin.eu/body/4alex_/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 303,
  },
  {
    name: 'Frostivn', slug: 'namemc-frostivn', source: 'NameMC',
    sourceUrl: 'https://namemc.com/profile/Frostivn', creator: 'Frostivn',
    imageUrl: 'https://mineskin.eu/body/Frostivn/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 152,
  },
];

seedCatalog();

function seedCatalog(): void {
  const statement = db.prepare(`
    INSERT INTO catalog (name, slug, source, source_url, creator, image_url, model, tags, popularity, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name, source = excluded.source, source_url = excluded.source_url,
      creator = excluded.creator, image_url = excluded.image_url, model = excluded.model,
      tags = excluded.tags, popularity = excluded.popularity, updated_at = CURRENT_TIMESTAMP
  `);
  for (const skin of catalogSeeds) {
    statement.run(skin.name, skin.slug, skin.source, skin.sourceUrl, skin.creator, skin.imageUrl, skin.model, JSON.stringify(skin.tags), skin.popularity);
  }
}

function json(res: NodeResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function text(res: NodeResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
  res.end(body);
}

function readBody(req: NodeRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('Payload troppo grande'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw) as Record<string, unknown>); }
      catch { reject(new Error('JSON non valido')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req: NodeRequest): Record<string, string> {
  const header = String(req.headers.cookie || '');
  return Object.fromEntries(header.split(';').map((part: string) => part.trim().split('=')));
}

function sessionUser(req: NodeRequest): SessionUser | null {
  const token = parseCookies(req).sc_sid;
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`
    SELECT u.id, u.username, u.email, u.role, u.active, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
  `).get(tokenHash, Date.now()) as SessionUser | undefined;
  return row || null;
}

function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, Date.now() + SESSION_TTL_SECONDS * 1000);
  return token;
}

function sessionCookie(token: string): string {
  return `sc_sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie(): string {
  return 'sc_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
}

function publicUser(user: SessionUser): object {
  return { id: user.id, username: user.username, email: user.email, role: user.role, active: Boolean(user.active), createdAt: user.created_at };
}

function requireAdmin(req: NodeRequest, res: NodeResponse): SessionUser | null {
  const user = sessionUser(req);
  if (!user) { json(res, 401, { error: 'Autenticazione richiesta' }); return null; }
  if (user.role !== 'admin') { json(res, 403, { error: 'Accesso riservato agli admin' }); return null; }
  return user;
}

function recordActivity(userId: number | null, action: string, detail = ''): void {
  db.prepare('INSERT INTO activity (user_id, action, detail) VALUES (?, ?, ?)').run(userId, action, detail);
}

function catalogRows(query: string, source: string): object[] {
  let sql = `SELECT id, name, slug, source, source_url, creator, image_url, model, tags, popularity, updated_at FROM catalog`;
  const params: string[] = [];
  const conditions: string[] = [];
  if (query) { conditions.push('(name LIKE ? OR creator LIKE ? OR tags LIKE ?)'); params.push(`%${query}%`, `%${query}%`, `%${query}%`); }
  if (source && source !== 'all') { conditions.push('source = ?'); params.push(source); }
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY popularity DESC, updated_at DESC';
  return (db.prepare(sql).all(...params) as any[]).map((row: any) => ({
    id: row.id, name: row.name, slug: row.slug, source: row.source, sourceUrl: row.source_url,
    creator: row.creator, imageUrl: row.image_url, model: row.model, tags: JSON.parse(row.tags || '[]'), popularity: row.popularity,
  }));
}

function adminOverview(): object {
  const users = db.prepare('SELECT COUNT(*) AS count FROM users').get() as any;
  const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get() as any;
  const skins = db.prepare('SELECT COUNT(*) AS count FROM catalog').get() as any;
  const events = db.prepare('SELECT COUNT(*) AS count FROM activity').get() as any;
  const sources = db.prepare('SELECT source, COUNT(*) AS count FROM catalog GROUP BY source ORDER BY count DESC').all() as any[];
  const recent = db.prepare(`
    SELECT a.action, a.detail, a.created_at, u.username
    FROM activity a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 8
  `).all() as any[];
  return {
    users: Number(users.count), admins: Number(admins.count), catalog: Number(skins.count), events: Number(events.count),
    sources: sources.map((row: any) => ({ source: row.source, count: Number(row.count) })),
    recent: recent.map((row: any) => ({ action: row.action, detail: row.detail, createdAt: row.created_at, username: row.username || 'Sistema' })),
  };
}

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json',
};

function serveStatic(req: NodeRequest, res: NodeResponse, urlPath: string): void {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  if (requested.includes('..') || requested.startsWith('/.env') || requested.startsWith('/data') || requested.startsWith('/server')) {
    text(res, 404, 'Not found', 'text/plain; charset=utf-8'); return;
  }
  const filePath = path.resolve(ROOT, `.${requested}`);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    text(res, 404, 'Not found', 'text/plain; charset=utf-8'); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req: NodeRequest, res: NodeResponse, url: URL): Promise<boolean> {
  const method = String(req.method || 'GET').toUpperCase();
  const route = url.pathname;

  if (method === 'GET' && route === '/api/health') { json(res, 200, { ok: true, service: 'skin-control-center' }); return true; }
  if (method === 'GET' && route === '/api/me') {
    const user = sessionUser(req);
    if (!user) { json(res, 401, { error: 'Non autenticato' }); return true; }
    json(res, 200, { user: publicUser(user) }); return true;
  }
  if (method === 'POST' && route === '/api/auth/login') {
    try {
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const row = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as any;
      if (!row || !row.active || !verifyPassword(password, row.password_hash)) { json(res, 401, { error: 'Credenziali non valide' }); return true; }
      const token = createSession(Number(row.id));
      recordActivity(Number(row.id), 'login', 'Accesso effettuato');
      json(res, 200, { user: publicUser({ ...row, created_at: row.created_at } as SessionUser) }, { 'Set-Cookie': sessionCookie(token) });
    } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : 'Richiesta non valida' }); }
    return true;
  }
  if (method === 'POST' && route === '/api/auth/logout') {
    const token = parseCookies(req).sc_sid;
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(crypto.createHash('sha256').update(token).digest('hex'));
    json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() }); return true;
  }
  if (method === 'POST' && route === '/api/auth/register') {
    try {
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const email = String(body.email || '').trim() || null;
      const password = String(body.password || '');
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) { json(res, 400, { error: 'Username: 3-24 caratteri, solo lettere, numeri, punto, trattino o underscore' }); return true; }
      if (password.length < 8) { json(res, 400, { error: 'La password deve avere almeno 8 caratteri' }); return true; }
      const result = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, \'user\')').run(username, email, hashPassword(password));
      const userId = Number(result.lastInsertRowid);
      const token = createSession(userId);
      recordActivity(userId, 'register', 'Nuovo account creato');
      const user = db.prepare('SELECT id, username, email, role, active, created_at FROM users WHERE id = ?').get(userId) as SessionUser;
      json(res, 201, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(token) });
    } catch (error) { json(res, 400, { error: String(error).includes('UNIQUE') ? 'Username o email già utilizzati' : 'Impossibile creare l’account' }); }
    return true;
  }
  if (method === 'POST' && route === '/api/auth/change-password') {
    const user = sessionUser(req);
    if (!user) { json(res, 401, { error: 'Autenticazione richiesta' }); return true; }
    try {
      const body = await readBody(req);
      const current = String(body.currentPassword || '');
      const next = String(body.newPassword || '');
      const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;
      if (!verifyPassword(current, row.password_hash)) { json(res, 400, { error: 'Password attuale non corretta' }); return true; }
      if (next.length < 8) { json(res, 400, { error: 'La nuova password deve avere almeno 8 caratteri' }); return true; }
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
      recordActivity(user.id, 'password_change', 'Password aggiornata');
      json(res, 200, { ok: true });
    } catch { json(res, 400, { error: 'Richiesta non valida' }); }
    return true;
  }
  if (method === 'GET' && route === '/api/catalog') {
    json(res, 200, { items: catalogRows(String(url.searchParams.get('q') || '').trim(), String(url.searchParams.get('source') || 'all')) }); return true;
  }
  if (method === 'GET' && route === '/api/admin/overview') {
    if (!requireAdmin(req, res)) return true;
    json(res, 200, adminOverview()); return true;
  }
  if (method === 'GET' && route === '/api/admin/users') {
    if (!requireAdmin(req, res)) return true;
    const users = db.prepare('SELECT id, username, email, role, active, created_at FROM users ORDER BY created_at DESC').all() as any[];
    json(res, 200, { users: users.map((item: any) => publicUser(item as SessionUser)) }); return true;
  }
  if (method === 'PATCH' && route.match(/^\/api\/admin\/users\/\d+$/)) {
    const admin = requireAdmin(req, res); if (!admin) return true;
    try {
      const id = Number(route.split('/').pop());
      const body = await readBody(req);
      if (id === admin.id && body.active === false) { json(res, 400, { error: 'Non puoi disattivare il tuo account' }); return true; }
      if (body.role !== undefined && body.role !== 'admin' && body.role !== 'user') { json(res, 400, { error: 'Ruolo non valido' }); return true; }
      if (body.role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, id);
      if (body.active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
      recordActivity(admin.id, 'user_update', `Account ${id} aggiornato`);
      json(res, 200, { ok: true });
    } catch { json(res, 400, { error: 'Impossibile aggiornare l’account' }); }
    return true;
  }
  if (method === 'POST' && route === '/api/admin/catalog/sync') {
    const admin = requireAdmin(req, res); if (!admin) return true;
    seedCatalog(); recordActivity(admin.id, 'catalog_sync', 'Catalogo curato sincronizzato');
    json(res, 200, { items: catalogRows('', 'all'), message: 'Catalogo aggiornato con le fonti configurate' }); return true;
  }
  if (method === 'GET' && route === '/api/admin/activity') {
    if (!requireAdmin(req, res)) return true;
    const rows = db.prepare(`SELECT a.action, a.detail, a.created_at, u.username FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 50`).all() as any[];
    json(res, 200, { activity: rows }); return true;
  }
  return false;
}

const server = http.createServer(async (req: NodeRequest, res: NodeResponse) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url);
      if (!handled) json(res, 404, { error: 'Endpoint non trovato' });
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Errore interno del server' });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Skin Control Center disponibile su http://127.0.0.1:${PORT}`);
  console.log(`Database SQLite: ${DB_PATH}`);
});
