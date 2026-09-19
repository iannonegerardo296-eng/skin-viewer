'use strict';

const { handleApi, json } = require('../../lib/app');

function requestUrl(req) {
  const host = req.headers?.host || 'localhost';
  const parsed = new URL(String(req.url || '/'), `https://${host}`);
  const queryPath = req.query?.path;
  const parts = Array.isArray(queryPath) ? queryPath : (queryPath ? [queryPath] : []);
  const normalized = parts
    .flatMap((part) => String(part).split('/'))
    .map((part) => part.trim())
    .filter(Boolean);

  while (normalized[0] === 'api' || normalized[0] === 'admin') normalized.shift();
  const suffix = normalized.length ? `/${normalized.map(encodeURIComponent).join('/')}` : '';
  return new URL(`/api/admin${suffix}${parsed.search}`, `https://${host}`);
}

module.exports = async (req, res) => {
  try {
    const handled = await handleApi(req, res, requestUrl(req));
    if (!handled) json(res, 404, { error: 'Endpoint non trovato' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: error instanceof Error ? error.message : 'Errore interno del server' });
    else res.end();
  }
};

module.exports.requestUrl = requestUrl;
