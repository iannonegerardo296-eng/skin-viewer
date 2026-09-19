'use strict';

const { handleApi, json } = require('../lib/app');

function requestUrl(req) {
  const host = req.headers.host || 'localhost';
  const queryPath = req.query && req.query.path;
  if (Array.isArray(queryPath) && queryPath.length) {
    return new URL(`/api/${queryPath.map((part) => encodeURIComponent(String(part))).join('/')}`, `https://${host}`);
  }
  if (typeof queryPath === 'string' && queryPath) {
    return new URL(`/api/${queryPath}`, `https://${host}`);
  }
  const requestPath = String(req.url || '/');
  return new URL(requestPath.startsWith('/api/') ? requestPath : `/api${requestPath === '/' ? '' : requestPath}`, `https://${host}`);
}

module.exports = async (req, res) => {
  try {
    const url = requestUrl(req);
    const handled = await handleApi(req, res, url);
    if (!handled) json(res, 404, { error: 'Endpoint non trovato' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Errore interno del server' });
    else res.end();
  }
};
