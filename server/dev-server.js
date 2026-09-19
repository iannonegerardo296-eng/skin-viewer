'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleApi, json } = require('../lib/app');

const ROOT = path.resolve(__dirname, '..');
const configuredPort = Number(process.env.PORT);
const PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 8000;

function loadEnvFile() {
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

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json',
};

function text(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  if (requested.includes('..') || requested.startsWith('/.env') || requested.startsWith('/data') || requested.startsWith('/server') || requested.startsWith('/lib') || requested.startsWith('/api')) {
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

const server = http.createServer(async (req, res) => {
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
  if (!process.env.TURSO_DATABASE_URL) console.log(`Database SQLite locale: ${path.join(ROOT, 'data', 'skin-control.sqlite')}`);
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.log('Nessun admin di default: imposta ADMIN_USERNAME e ADMIN_PASSWORD in .env.local per creare il primo account admin, poi registrane uno da /api/auth/register e promuovilo, oppure usa quelle variabili al primo avvio.');
  }
});
