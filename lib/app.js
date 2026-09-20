'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@libsql/client');

const ROOT = path.resolve(__dirname, '..');
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

// ---------------------------------------------------------------------------
// Database
//
// Works two ways, with the SAME code and the SAME SQL:
//  - Locally: a SQLite file on disk (data/skin-control.sqlite). No native
//    build step, no `--experimental-sqlite` flag needed.
//  - On Vercel (or any serverless host): point TURSO_DATABASE_URL /
//    TURSO_AUTH_TOKEN at a free Turso (libSQL) database. Vercel's filesystem
//    is read-only/ephemeral outside /tmp, so a local file can't be used as
//    the real database in production - Turso talks to the DB over HTTP
//    instead, which is what makes this work on serverless.
// ---------------------------------------------------------------------------

let clientPromise = null;

function getClient() {
  if (!clientPromise) clientPromise = initClient();
  return clientPromise;
}

async function initClient() {
  const remoteUrl = process.env.TURSO_DATABASE_URL;
  let client;
  if (remoteUrl) {
    if (!process.env.TURSO_AUTH_TOKEN) throw new Error('TURSO_AUTH_TOKEN mancante: configura URL e token del database.');
    client = createClient({ url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  } else if (process.env.VERCEL) {
    // No Turso configured: fall back to /tmp so the function doesn't crash
    // (the rest of the filesystem is read-only on Vercel), but this is
    // EPHEMERAL - data can vanish between invocations/deploys. Fine for a
    // quick preview, not for real persistence. Set TURSO_DATABASE_URL for that.
    console.warn('[skin-control] TURSO_DATABASE_URL non impostata: uso un database temporaneo in /tmp, i dati NON persistono su Vercel.');
    client = createClient({ url: 'file:/tmp/skin-control.sqlite' });
  } else {
    const dataDir = path.join(ROOT, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    client = createClient({ url: `file:${path.join(dataDir, 'skin-control.sqlite')}` });
  }
  await migrate(client);
  await seedAdminIfConfigured(client);
  await seedCatalog(client);
  return client;
}

async function migrate(client) {
  await client.executeMultiple(`
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
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// No hardcoded default admin/password. An initial admin is only created when
// ADMIN_USERNAME + ADMIN_PASSWORD are explicitly set (e.g. in .env.local for
// dev, or as Vercel project environment variables for a real deployment).
// This avoids shipping a guessable "admin account" that anyone could log
// into on a public URL.
async function seedAdminIfConfigured(client) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const existing = await client.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
  if (existing.rows.length) return;
  await client.execute({
    sql: `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
    args: [username, process.env.ADMIN_EMAIL || null, hashPassword(password)],
  });
  console.log(`Admin iniziale creato: ${username}`);
}

const catalogSeeds = [
  { name: 'Mikeskin', slug: 'planet-minecraft-mikeskin', source: 'Planet Minecraft', sourceUrl: 'https://www.planetminecraft.com/skin/mikeskin/', creator: 'Brambolinie', imageUrl: 'https://mineskin.eu/body/Mikeskin/240.png', model: 'wide', tags: ['classic', 'planet minecraft'], popularity: 111 },
  { name: 'koakumaris', slug: 'namemc-koakumaris', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/koakumaris', creator: 'koakumaris', imageUrl: 'https://mineskin.eu/body/koakumaris/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 1398 },
  { name: 'yibbu', slug: 'namemc-yibbu', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/yibbu', creator: 'yibbu', imageUrl: 'https://mineskin.eu/body/yibbu/240.png', model: 'slim', tags: ['trending', 'community'], popularity: 214 },
  { name: 'undespairing', slug: 'namemc-undespairing', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/undespairing', creator: 'undespairing', imageUrl: 'https://mineskin.eu/body/undespairing/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 882 },
  { name: 'nx9_msmc_nzh', slug: 'namemc-nx9-msmc-nzh', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/nx9_msmc_nzh', creator: 'nx9_msmc_nzh', imageUrl: 'https://mineskin.eu/body/nx9_msmc_nzh/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 476 },
  { name: 'manyero', slug: 'namemc-manyero', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/manyero', creator: 'manyero', imageUrl: 'https://mineskin.eu/body/manyero/240.png', model: 'slim', tags: ['trending', 'community'], popularity: 159 },
  { name: 'Nospu', slug: 'namemc-nospu', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/Nospu', creator: 'Nospu', imageUrl: 'https://mineskin.eu/body/Nospu/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 265 },
  { name: 'yeowun', slug: 'namemc-yeowun', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/yeowun', creator: 'yeowun', imageUrl: 'https://mineskin.eu/body/yeowun/240.png', model: 'slim', tags: ['trending', 'community'], popularity: 69 },
  { name: '4alex_', slug: 'namemc-4alex', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/4alex_', creator: '4alex_', imageUrl: 'https://mineskin.eu/body/4alex_/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 303 },
  { name: 'Frostivn', slug: 'namemc-frostivn', source: 'NameMC', sourceUrl: 'https://namemc.com/profile/Frostivn', creator: 'Frostivn', imageUrl: 'https://mineskin.eu/body/Frostivn/240.png', model: 'wide', tags: ['trending', 'community'], popularity: 152 },
];

async function seedCatalog(client) {
  for (const skin of catalogSeeds) {
    await client.execute({
      sql: `INSERT INTO catalog (name, slug, source, source_url, creator, image_url, model, tags, popularity, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(slug) DO UPDATE SET
              name = excluded.name, source = excluded.source, source_url = excluded.source_url,
              creator = excluded.creator, image_url = excluded.image_url, model = excluded.model,
              tags = excluded.tags, popularity = excluded.popularity, updated_at = CURRENT_TIMESTAMP`,
      args: [skin.name, skin.slug, skin.source, skin.sourceUrl, skin.creator, skin.imageUrl, skin.model, JSON.stringify(skin.tags), skin.popularity],
    });
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers (work the same on plain http.createServer and on Vercel's
// Node request/response objects)
// ---------------------------------------------------------------------------

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (tooLarge) return;
      raw += chunk;
      if (raw.length > 1_000_000) {
        tooLarge = true;
        reject(new Error('Payload troppo grande'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('JSON non valido')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const header = String(req.headers.cookie || '');
  return Object.fromEntries(header.split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return [part.trim(), ''];
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }));
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function validateAccountInput(body) {
  const username = String(body.username || '').trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const role = body.role === 'admin' ? 'admin' : 'user';
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
    throw new Error('Username: 3-24 caratteri, solo lettere, numeri, punto, trattino o underscore');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Inserisci un indirizzo email valido');
  if (password.length < 8) throw new Error('La password deve avere almeno 8 caratteri');
  return { username, email, password, role };
}

async function sessionUser(client, req) {
  const token = parseCookies(req).sc_sid;
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await client.execute({
    sql: `SELECT u.id, u.username, u.email, u.role, u.active, u.created_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    args: [tokenHash, Date.now()],
  });
  return result.rows[0] || null;
}

async function createSession(client, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await client.execute({
    sql: 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    args: [tokenHash, userId, Date.now() + SESSION_TTL_SECONDS * 1000],
  });
  return token;
}

function sessionCookie(token) {
  return `sc_sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie() {
  return 'sc_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
}

function publicUser(user) {
  return { id: Number(user.id), username: user.username, email: user.email, role: user.role, active: Boolean(user.active), createdAt: user.created_at };
}

async function requireAdmin(client, req, res) {
  const user = await sessionUser(client, req);
  if (!user) { json(res, 401, { error: 'Autenticazione richiesta' }); return null; }
  if (user.role !== 'admin') { json(res, 403, { error: 'Accesso riservato agli admin' }); return null; }
  return user;
}

async function recordActivity(client, userId, action, detail = '') {
  await client.execute({ sql: 'INSERT INTO activity (user_id, action, detail) VALUES (?, ?, ?)', args: [userId, action, detail] });
}

async function catalogRows(client, query, source) {
  let sql = `SELECT id, name, slug, source, source_url, creator, image_url, model, tags, popularity, updated_at FROM catalog`;
  const args = [];
  const conditions = [];
  if (query) { conditions.push('(name LIKE ? OR creator LIKE ? OR tags LIKE ?)'); args.push(`%${query}%`, `%${query}%`, `%${query}%`); }
  if (source && source !== 'all') { conditions.push('source = ?'); args.push(source); }
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY popularity DESC, updated_at DESC';
  const result = await client.execute({ sql, args });
  return result.rows.map((row) => ({
    id: Number(row.id), name: row.name, slug: row.slug, source: row.source, sourceUrl: row.source_url,
    creator: row.creator, imageUrl: row.image_url, model: row.model, tags: JSON.parse(row.tags || '[]'), popularity: Number(row.popularity),
  }));
}

async function adminOverview(client) {
  const users = await client.execute('SELECT COUNT(*) AS count FROM users');
  const admins = await client.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
  const skins = await client.execute('SELECT COUNT(*) AS count FROM catalog');
  const events = await client.execute('SELECT COUNT(*) AS count FROM activity');
  const sources = await client.execute('SELECT source, COUNT(*) AS count FROM catalog GROUP BY source ORDER BY count DESC');
  const recent = await client.execute(`
    SELECT a.action, a.detail, a.created_at, u.username
    FROM activity a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 8
  `);
  return {
    users: Number(users.rows[0].count), admins: Number(admins.rows[0].count), catalog: Number(skins.rows[0].count), events: Number(events.rows[0].count),
    sources: sources.rows.map((row) => ({ source: row.source, count: Number(row.count) })),
    recent: recent.rows.map((row) => ({ action: row.action, detail: row.detail, createdAt: row.created_at, username: row.username || 'Sistema' })),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const client = await getClient();
  const method = String(req.method || 'GET').toUpperCase();
  const route = url.pathname;

  if (method === 'GET' && route === '/api/health') { json(res, 200, { ok: true, service: 'skin-control-center' }); return true; }

  if (method === 'GET' && route === '/api/me') {
    const user = await sessionUser(client, req);
    if (!user) { json(res, 401, { error: 'Non autenticato' }); return true; }
    json(res, 200, { user: publicUser(user) }); return true;
  }

  if (method === 'POST' && route === '/api/auth/login') {
    try {
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const result = await client.execute({ sql: 'SELECT * FROM users WHERE username = ? COLLATE NOCASE', args: [username] });
      const row = result.rows[0];
      if (!row || !row.active || !verifyPassword(password, row.password_hash)) { json(res, 401, { error: 'Credenziali non valide' }); return true; }
      const token = await createSession(client, Number(row.id));
      await recordActivity(client, Number(row.id), 'login', 'Accesso effettuato');
      json(res, 200, { user: publicUser(row) }, { 'Set-Cookie': sessionCookie(token) });
    } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : 'Richiesta non valida' }); }
    return true;
  }

  if (method === 'POST' && route === '/api/auth/logout') {
    const token = parseCookies(req).sc_sid;
    if (token) await client.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [crypto.createHash('sha256').update(token).digest('hex')] });
    json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() }); return true;
  }

  if (method === 'POST' && route === '/api/auth/register') {
    try {
      const { username, email, password } = validateAccountInput(await readBody(req));
      const result = await client.execute({
        sql: `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'user')`,
        args: [username, email, hashPassword(password)],
      });
      const userId = Number(result.lastInsertRowid);
      const token = await createSession(client, userId);
      await recordActivity(client, userId, 'register', 'Nuovo account creato');
      const created = await client.execute({ sql: 'SELECT id, username, email, role, active, created_at FROM users WHERE id = ?', args: [userId] });
      json(res, 201, { user: publicUser(created.rows[0]) }, { 'Set-Cookie': sessionCookie(token) });
    } catch (error) {
      const message = String((error && error.message) || error);
      json(res, 400, { error: message.includes('UNIQUE') ? 'Username o email già utilizzati' : 'Impossibile creare l’account' });
    }
    return true;
  }

  if (method === 'POST' && route === '/api/auth/change-password') {
    const user = await sessionUser(client, req);
    if (!user) { json(res, 401, { error: 'Autenticazione richiesta' }); return true; }
    try {
      const body = await readBody(req);
      const current = String(body.currentPassword || '');
      const next = String(body.newPassword || '');
      const result = await client.execute({ sql: 'SELECT password_hash FROM users WHERE id = ?', args: [user.id] });
      if (!verifyPassword(current, result.rows[0].password_hash)) { json(res, 400, { error: 'Password attuale non corretta' }); return true; }
      if (next.length < 8) { json(res, 400, { error: 'La nuova password deve avere almeno 8 caratteri' }); return true; }
      await client.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hashPassword(next), user.id] });
      await recordActivity(client, user.id, 'password_change', 'Password aggiornata');
      json(res, 200, { ok: true });
    } catch { json(res, 400, { error: 'Richiesta non valida' }); }
    return true;
  }

  if (method === 'GET' && route === '/api/catalog') {
    json(res, 200, { items: await catalogRows(client, String(url.searchParams.get('q') || '').trim(), String(url.searchParams.get('source') || 'all')) }); return true;
  }

  if (method === 'GET' && route === '/api/admin/overview') {
    if (!(await requireAdmin(client, req, res))) return true;
    json(res, 200, await adminOverview(client)); return true;
  }

  if (method === 'GET' && route === '/api/admin/users') {
    if (!(await requireAdmin(client, req, res))) return true;
    const result = await client.execute('SELECT id, username, email, role, active, created_at FROM users ORDER BY created_at DESC');
    json(res, 200, { users: result.rows.map(publicUser) }); return true;
  }

  if (method === 'POST' && route === '/api/admin/users') {
    const admin = await requireAdmin(client, req, res); if (!admin) return true;
    try {
      const { username, email, password, role } = validateAccountInput(await readBody(req));
      const result = await client.execute({
        sql: 'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        args: [username, email, hashPassword(password), role],
      });
      const userId = Number(result.lastInsertRowid);
      await recordActivity(client, admin.id, 'user_create', `Account "${username}" creato con ruolo ${role}`);
      const created = await client.execute({ sql: 'SELECT id, username, email, role, active, created_at FROM users WHERE id = ?', args: [userId] });
      json(res, 201, { user: publicUser(created.rows[0]) });
    } catch (error) {
      const message = String((error && error.message) || error);
      json(res, 400, { error: message.includes('UNIQUE') ? 'Username o email già utilizzati' : 'Impossibile creare l’account' });
    }
    return true;
  }

  const userPatchMatch = route.match(/^\/api\/admin\/users\/(\d+)$/);
  if (method === 'PATCH' && userPatchMatch) {
    const admin = await requireAdmin(client, req, res); if (!admin) return true;
    try {
      const id = Number(userPatchMatch[1]);
      const body = await readBody(req);
      if (id === admin.id && body.active === false) { json(res, 400, { error: 'Non puoi disattivare il tuo account' }); return true; }
      if (body.role !== undefined && body.role !== 'admin' && body.role !== 'user') { json(res, 400, { error: 'Ruolo non valido' }); return true; }
      if (body.role !== undefined) await client.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: [body.role, id] });
      if (body.active !== undefined) await client.execute({ sql: 'UPDATE users SET active = ? WHERE id = ?', args: [body.active ? 1 : 0, id] });
      await recordActivity(client, admin.id, 'user_update', `Account ${id} aggiornato`);
      json(res, 200, { ok: true });
    } catch { json(res, 400, { error: 'Impossibile aggiornare l’account' }); }
    return true;
  }

  if (method === 'POST' && route === '/api/admin/catalog/upload') {
    const admin = await requireAdmin(client, req, res); if (!admin) return true;
    try {
      const body = await readBody(req);
      const imageDataUrl = String(body.imageDataUrl || '');
      const match = imageDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      if (!match) { json(res, 400, { error: 'Carica un file immagine PNG valido (skin 64×64 o multiplo)' }); return true; }
      if (match[1].length > 400_000) { json(res, 400, { error: 'Immagine troppo grande (limite ~300 KB)' }); return true; }
      const name = String(body.name || '').trim().slice(0, 60) || 'Skin senza nome';
      const model = body.model === 'slim' ? 'slim' : 'wide';
      const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6) : [];
      const slug = `admin-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
      await client.execute({
        sql: `INSERT INTO catalog (name, slug, source, source_url, creator, image_url, model, tags, popularity, updated_at)
              VALUES (?, ?, 'Caricamento admin', '', ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
        args: [name, slug, admin.username, imageDataUrl, model, JSON.stringify(tags)],
      });
      await recordActivity(client, admin.id, 'catalog_upload', `Skin "${name}" caricata nel catalogo`);
      json(res, 201, { items: await catalogRows(client, '', 'all') });
    } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : 'Caricamento non riuscito' }); }
    return true;
  }

  if (method === 'POST' && route === '/api/admin/catalog/sync') {
    const admin = await requireAdmin(client, req, res); if (!admin) return true;
    await seedCatalog(client);
    await recordActivity(client, admin.id, 'catalog_sync', 'Catalogo curato sincronizzato');
    json(res, 200, { items: await catalogRows(client, '', 'all'), message: 'Catalogo aggiornato con le fonti configurate' }); return true;
  }

  if (method === 'GET' && route === '/api/admin/activity') {
    if (!(await requireAdmin(client, req, res))) return true;
    const result = await client.execute('SELECT a.action, a.detail, a.created_at, u.username FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 50');
    json(res, 200, {
      activity: result.rows.map((row) => ({
        action: row.action,
        detail: row.detail || '',
        createdAt: row.created_at,
        username: row.username || 'Sistema',
      })),
    }); return true;
  }

  return false;
}

module.exports = { handleApi, json, getClient };
