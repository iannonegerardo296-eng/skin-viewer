'use strict';

const { handleApi, json } = require('./app');

function createApiHandler(route) {
  return async (req, res) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(route, `https://${host}`);
      const handled = await handleApi(req, res, url);
      if (!handled) json(res, 404, { error: 'Endpoint non trovato' });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) json(res, 500, { error: 'Errore interno del server' });
      else res.end();
    }
  };
}

module.exports = { createApiHandler };
