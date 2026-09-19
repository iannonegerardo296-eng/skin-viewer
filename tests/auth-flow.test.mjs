import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handleApi } = require('../lib/app.js');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
      this.headersSent = true;
      return this;
    },
    end(body) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
  };
}

async function callApi(req, res) {
  const url = new URL(req.url, 'https://example.test');
  const handled = await handleApi(req, res, url);
  return { handled, res };
}

test('register and login flow creates a session and returns the authenticated user', async () => {
  const username = `authuser_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const password = 'SecretPass123!';

  const registerReq = {
    method: 'POST',
    url: '/api/auth/register',
    headers: { host: 'example.test' },
    setEncoding() {},
    on(event, handler) {
      if (event === 'data') return;
      if (event === 'end') return;
      if (event === 'error') return;
    },
    async _payload() {
      return { username, email: `${username}@example.com`, password };
    },
  };

  const registerRes = mockRes();
  const registerBody = JSON.stringify({ username, email: `${username}@example.com`, password });
  registerReq.on = (event, handler) => {
    if (event === 'data') {
      queueMicrotask(() => handler(registerBody));
    }
    if (event === 'end') {
      queueMicrotask(() => handler());
    }
  };

  const registerResult = await callApi(registerReq, registerRes);
  assert.equal(registerResult.handled, true);
  assert.equal(registerRes.statusCode, 201);
  assert.match(String(registerRes.headers['Set-Cookie'] || ''), /sc_sid=/);

  const loginReq = {
    method: 'POST',
    url: '/api/auth/login',
    headers: { host: 'example.test', cookie: registerRes.headers['Set-Cookie'] },
    setEncoding() {},
    on(event, handler) {
      if (event === 'data') {
        queueMicrotask(() => handler(JSON.stringify({ username, password })));
      }
      if (event === 'end') {
        queueMicrotask(() => handler());
      }
    },
  };

  const loginRes = mockRes();
  const loginResult = await callApi(loginReq, loginRes);
  assert.equal(loginResult.handled, true);
  assert.equal(loginRes.statusCode, 200);
  assert.match(String(loginRes.headers['Set-Cookie'] || ''), /sc_sid=/);

  const meReq = {
    method: 'GET',
    url: '/api/me',
    headers: { host: 'example.test', cookie: loginRes.headers['Set-Cookie'] },
  };

  const meRes = mockRes();
  const meResult = await callApi(meReq, meRes);
  assert.equal(meResult.handled, true);
  assert.equal(meRes.statusCode, 200);
  const me = JSON.parse(meRes.body);
  assert.equal(me.user.username, username);
  assert.equal(me.user.role, 'user');
});
