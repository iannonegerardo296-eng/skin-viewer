'use strict';

const { handleApi, json } = require('../../../../lib/app');

module.exports = async (req, res) => {
  try {
    const id = String(req.query?.id || '').trim();
    const url = new URL(`/api/admin/catalog/proposals/${encodeURIComponent(id)}`, `https://${req.headers?.host || 'localhost'}`);
    const handled = await handleApi(req, res, url);
    if (!handled) json(res, 404, { error: 'Endpoint non trovato' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: error instanceof Error ? error.message : 'Errore interno del server' });
    else res.end();
  }
};
