'use strict';

const { handleApi, json } = require('../lib/app');

function requestUrl(req) {
  const host = req.headers?.host || 'localhost';
  const rawUrl = String(req.url || '/');
  const parsed = new URL(rawUrl, `https://${host}`);
  const queryPath = req.query?.path;
  const parts = Array.isArray(queryPath) ? queryPath : (queryPath ? [queryPath] : []);

  if (parts.length) {
    const normalized = parts
      .flatMap((part) => String(part).split('/'))
      .map((part) => part.trim())
      .filter(Boolean);

    while (normalized[0] === 'api') normalized.shift();
    if (normalized.length) {
      const pathname = `/api/${normalized.map(encodeURIComponent).join('/')}`;
      return new URL(`${pathname}${parsed.search}`, `https://${host}`);
    }
  }

  let pathname = parsed.pathname;
  if (!pathname.startsWith('/api/')) pathname = `/api${pathname === '/' ? '' : pathname}`;
  return new URL(`${pathname}${parsed.search}`, `https://${host}`);
}

module.exports = async (req, res) => {
  try {
    const url = requestUrl(req);
    const handled = await handleApi(req, res, url);
    if (!handled) json(res, 404, { error: 'Endpoint non trovato' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: error instanceof Error ? error.message : 'Errore interno del server' });
    else res.end();
  }
};

module.exports.requestUrl = requestUrl;
