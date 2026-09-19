import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { requestUrl } = require('../api/[...path].js');

test('preserves query string on direct API paths', () => {
  const url = requestUrl({ headers: { host: 'example.com' }, url: '/api/catalog?q=blue&source=NameMC' });
  assert.equal(url.pathname, '/api/catalog');
  assert.equal(url.search, '?q=blue&source=NameMC');
});

test('normalizes catch-all paths without dropping the original query', () => {
  const url = requestUrl({ headers: { host: 'example.com' }, url: '/api/catalog?source=NameMC', query: { path: ['/api', 'catalog'] } });
  assert.equal(url.pathname, '/api/catalog');
  assert.equal(url.search, '?source=NameMC');
});
