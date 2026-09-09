const { test, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/job_tracker_test';
const { app, pool } = require('../index');
const server = app.listen(0, '127.0.0.1');
const ready = new Promise(resolve => server.once('listening', resolve));
async function request(path, method = 'GET', body, token) {
  await ready;
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });
test('API rejects unauthenticated access and malformed credentials', async () => {
  assert.equal((await request('/jobs')).status, 401);
  assert.equal((await request('/auth/signup', 'POST', { email: {}, password: [] })).status, 400);
  assert.equal((await request('/auth/login', 'POST', { email: 'user@example.com', password: 'x' })).status, 400);
});
test('registration, login, CRUD, validation and per-user isolation', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const suffix = Date.now();
  const first = await request('/auth/signup', 'POST', { email: `first-${suffix}@example.test`, password: 'Test-password-123' });
  const second = await request('/auth/signup', 'POST', { email: `second-${suffix}@example.test`, password: 'Test-password-123' });
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  const token = first.body.token;
  try {
    assert.equal((await request('/auth/login', 'POST', { email: `first-${suffix}@example.test`, password: 'Test-password-123' })).status, 200);
    assert.equal((await request('/jobs', 'POST', { company: 'Acme', role: 'Engineer', date_applied: '2026-02-30' }, token)).status, 400);
    const created = await request('/jobs', 'POST', { company: 'Acme', role: 'Engineer' }, token);
    assert.equal(created.status, 201);
    const path = `/jobs/${created.body.id}`;
    assert.equal((await request(path, 'GET', undefined, second.body.token)).status, 404);
    assert.equal((await request(path, 'PUT', { company: 'Other', role: 'Engineer' }, second.body.token)).status, 404);
    assert.equal((await request(path, 'DELETE', undefined, second.body.token)).status, 404);
    assert.equal((await request(path, 'PUT', { company: 'Acme', role: 'Backend', status: 'Interview' }, token)).status, 200);
    assert.equal((await request('/jobs', 'GET', undefined, token)).body.length, 1);
    assert.equal((await request(path, 'DELETE', undefined, token)).status, 200);
  } finally {
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [[first.body.user.id, second.body.user.id]]);
  }
});
