'use strict';

const { handleApi, json } = require('../../../lib/app');

module.exports = async (req, res) => {
  try {
    const id = String(req.query?.id || '').trim();
    if (!/^\d+$/.test(id)) {
      json(res, 400, { error: 'Identificativo account non valido' });
      return;
    }
    const url = new URL(`/api/admin/users/${id}`, `https://${req.headers.host || 'localhost'}`);
    const handled = await handleApi(req, res, url);
    if (!handled) json(res, 404, { error: 'Endpoint non trovato' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Errore interno del server' });
    else res.end();
  }
};
