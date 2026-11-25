import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import ejs from 'ejs';
import pg from 'pg';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const schema = `w05_verify_${process.pid}_${randomBytes(5).toString('hex')}`;
const connectionString = process.env.DB_URL || process.env.DATABASE_URL;
assert.ok(connectionString, 'DB_URL or DATABASE_URL must be set');
const databaseUrl = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), 'W05 verification refuses nonlocal databases');
const client = new pg.Client({ connectionString, ssl: false, connectionTimeoutMillis: 10000 });
let schemaCreated = false;
let server;
let serverErrors = '';
let baseUrl;

class Browser {
  constructor() {
    this.cookies = new Map();
  }

  async request(resource, { method = 'GET', body, status = 200, json = false } = {}) {
    const headers = {};
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    let payload;
    if (body !== undefined) {
      if (json) {
        headers['content-type'] = 'application/json';
        payload = JSON.stringify(body);
      } else {
        headers['content-type'] = 'application/x-www-form-urlencoded';
        const values = new URLSearchParams();
        for (const [name, value] of Object.entries(body)) {
          if (value === undefined) continue;
          for (const item of Array.isArray(value) ? value : [value]) values.append(name, String(item));
        }
        payload = values.toString();
      }
    }
    const response = await fetch(`${baseUrl}${resource}`, { method, body: payload, headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    for (const cookie of response.headers.getSetCookie?.() || []) {
      const pair = cookie.split(';', 1)[0];
      const separator = pair.indexOf('=');
      if (separator > 0) {
        const name = pair.slice(0, separator);
        const value = pair.slice(separator + 1);
        if (value) this.cookies.set(name, value);
        else this.cookies.delete(name);
      }
    }
    const html = await response.text();
    assert.equal(response.status, status, `${method} ${resource}: HTTP ${status}`);
    return { response, html };
  }

  get(resource, options = {}) {
    return this.request(resource, options);
  }

  post(resource, body, options = {}) {
    return this.request(resource, { ...options, method: 'POST', body, status: options.status ?? 303 });
  }
}

const redirectPath = (result, expected) => {
  const location = result.response.headers.get('location');
  assert.ok(location, 'Redirect has a Location header');
  const path = new URL(location, baseUrl).pathname;
  if (expected instanceof RegExp) assert.match(path, expected);
  else assert.equal(path, expected);
  return path;
};

const userCount = async () => Number((await client.query('SELECT COUNT(*) FROM users')).rows[0].count);
const organizationCount = async () => Number((await client.query('SELECT COUNT(*) FROM organization')).rows[0].count);
const userByEmail = async (email) => (await client.query('SELECT u.*, r.role_name FROM users u JOIN roles r USING(role_id) WHERE email = $1', [email])).rows[0] || null;

const startServer = async () => {
  const testUrl = new URL(connectionString);
  testUrl.searchParams.set('options', `-c search_path=${schema}`);
  server = spawn(process.execPath, ['server.js'], {
    cwd: projectDirectory,
    env: { ...process.env, DB_URL: testUrl.href, DATABASE_URL: testUrl.href, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '0', SESSION_SECRET: randomBytes(48).toString('hex'), ENABLE_SQL_LOGGING: 'false' },
  });
  server.stderr.on('data', (chunk) => { serverErrors += chunk; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timeout: ${serverErrors}`)), 30000);
    let output = '';
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${serverErrors}`)); });
    server.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Server is running at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
};

const assertGuestNavigation = (html) => {
  assert.ok(html.includes('href="/register"') && html.includes('href="/login"'));
  assert.ok(!html.includes('href="/dashboard"') && !html.includes('action="/logout"'));
};

const assertLoggedNavigation = (html) => {
  assert.ok(html.includes('href="/dashboard"') && html.includes('action="/logout"'));
  assert.ok(!html.includes('href="/register"') && !html.includes('href="/login"'));
};

try {
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  await client.query(`SET search_path TO ${schema}`);
  await client.query(await readFile(new URL('../src/setup.sql', import.meta.url), 'utf8'));
  const roles = await client.query('SELECT role_name FROM roles ORDER BY role_name');
  assert.deepEqual(roles.rows, [{ role_name: 'admin' }, { role_name: 'user' }]);
  assert.equal(await userCount(), 0);
  const views = (await readdir(new URL('../src/views', import.meta.url), { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.ejs'));
  for (const view of views) ejs.compile(await readFile(new URL(`../src/views/${view.name}`, import.meta.url), 'utf8'), { filename: view.name });
  const routes = await readFile(new URL('../src/routes.js', import.meta.url), 'utf8');
  for (const route of ['/register', '/login', '/logout', '/dashboard', '/users']) assert.ok(routes.includes(route));
  for (const route of ['/new-organization', '/edit-organization/:id', '/new-project', '/edit-project/:id', '/new-category', '/edit-category/:id', '/assign-categories/:projectId', '/project/:projectId/assign-categories']) {
    const lines = routes.split('\n').filter((line) => line.includes(route));
    assert.ok(lines.length === 2 && lines.every((line) => line.includes("requireRole('admin')")), `${route}: both routes require admin`);
  }
  const usersModel = await readFile(new URL('../src/models/users.js', import.meta.url), 'utf8');
  assert.ok(/bcrypt\.compare/.test(usersModel));
  const listFunction = usersModel.match(/const getAllUsers[\s\S]*?return result\.rows;\n};/)?.[0] || '';
  assert.ok(listFunction && !listFunction.includes('password_hash'), 'User list query does not include hashes');
  baseUrl = await startServer();

  const guest = new Browser();
  const regular = new Browser();
  const admin = new Browser();
  const guestHome = await guest.get('/');
  assertGuestNavigation(guestHome.html);
  for (const resource of ['/register', '/login']) {
    const html = (await guest.get(resource)).html;
    assert.ok(html.includes('<form') && html.includes('type="password"'));
  }
  const protectedGuest = await guest.get('/dashboard', { status: 303 });
  redirectPath(protectedGuest, '/login');
  const loginAfterRedirect = await guest.get('/login');
  assert.match(loginAfterRedirect.html, /must be logged in/i);
  assert.doesNotMatch((await guest.get('/login')).html, /must be logged in/i);
  for (const resource of ['/new-organization', '/edit-project/1', '/users']) redirectPath(await guest.get(resource, { status: 303 }), '/login');

  const invalidBase = await userCount();
  for (const body of [
    {},
    { name: 'A', email: 'bad', password: 'short' },
    { name: ['Array'], email: 'array@example.com', password: 'cse340!' },
    { name: 'Too Long', email: 'long@example.com', password: 'x'.repeat(73) },
  ]) {
    const result = await regular.post('/register', body, { json: Array.isArray(body.name) });
    redirectPath(result, '/register');
    assert.equal(await userCount(), invalidBase);
    const html = (await regular.get('/register')).html;
    assert.ok(/required|between|valid|bytes/i.test(html));
    assert.ok(!html.includes('value="cse340!"') && !html.includes('value="short"'));
  }

  const regularEmail = `regular-${schema}@example.com`;
  redirectPath(await regular.post('/register', { name: 'Regular User', email: regularEmail, password: 'regular!' }), '/login');
  const regularRow = await userByEmail(regularEmail);
  assert.equal(regularRow.role_name, 'user');
  assert.notEqual(regularRow.password_hash, 'regular!');
  assert.ok(await bcrypt.compare('regular!', regularRow.password_hash));
  const duplicate = await regular.post('/register', { name: 'Duplicate', email: regularEmail.toUpperCase(), password: 'regular!' });
  redirectPath(duplicate, '/register');
  assert.equal(await userCount(), invalidBase + 1);
  assert.match((await regular.get('/register')).html, /already exists/i);

  const wrongLogin = await regular.post('/login', { email: regularEmail, password: 'wrong-password' });
  redirectPath(wrongLogin, '/login');
  assert.match((await regular.get('/login')).html, /Invalid email or password/i);
  const oldCookie = regular.cookies.get('connect.sid');
  redirectPath(await regular.post('/login', { email: regularEmail, password: 'regular!' }), '/dashboard');
  const newCookie = regular.cookies.get('connect.sid');
  assert.ok(newCookie && newCookie !== oldCookie, 'Login regenerates the session');
  const regularDashboard = await regular.get('/dashboard');
  assertLoggedNavigation(regularDashboard.html);
  assert.ok(regularDashboard.html.includes('Regular User') && regularDashboard.html.includes(regularEmail) && regularDashboard.html.includes('user'));
  assert.ok(!regularDashboard.html.includes('href="/users"'));
  for (const resource of ['/', '/organizations', '/project/1']) assertLoggedNavigation((await regular.get(resource)).html);
  for (const resource of ['/new-organization', '/edit-organization/1', '/new-project', '/edit-project/1', '/new-category', '/edit-category/1', '/assign-categories/1', '/project/1/assign-categories', '/users']) {
    const result = await regular.get(resource, { status: 303 });
    redirectPath(result, '/dashboard');
  }
  const organizationsBefore = await organizationCount();
  redirectPath(await regular.post('/new-organization', { name: 'Blocked Partner', description: 'No write', contactEmail: 'blocked@example.com' }), '/dashboard');
  assert.equal(await organizationCount(), organizationsBefore);
  const publicPage = await guest.get('/organization/1');
  assert.equal(publicPage.response.status, 200);
  assert.ok(!publicPage.html.includes('/edit-organization/1'));

  const adminEmail = 'admin@example.com';
  redirectPath(await admin.post('/register', { name: 'admin', email: adminEmail, password: 'cse340!' }), '/login');
  await client.query("UPDATE users SET role_id = (SELECT role_id FROM roles WHERE role_name = 'admin') WHERE email = $1", [adminEmail]);
  const adminRow = await userByEmail(adminEmail);
  assert.equal(adminRow.role_name, 'admin');
  assert.ok(await bcrypt.compare('cse340!', adminRow.password_hash));
  redirectPath(await admin.post('/login', { email: adminEmail, password: 'cse340!' }), '/dashboard');
  const adminDashboard = await admin.get('/dashboard');
  assert.ok(adminDashboard.html.includes('href="/users"'));
  assertLoggedNavigation(adminDashboard.html);
  const usersPage = await admin.get('/users');
  assert.ok(usersPage.html.includes(regularEmail) && usersPage.html.includes(adminEmail));
  assert.ok(!usersPage.html.includes(regularRow.password_hash) && !usersPage.html.includes(adminRow.password_hash));
  for (const resource of ['/organizations', '/organization/1', '/projects', '/project/1', '/categories', '/category/1']) {
    const html = (await admin.get(resource)).html;
    assert.match(html, /\/(?:new|edit|assign)-/);
  }
  for (const resource of ['/new-organization', '/edit-organization/1', '/new-project', '/edit-project/1', '/new-category', '/edit-category/1', '/assign-categories/1', '/project/1/assign-categories']) assert.equal((await admin.get(resource)).response.status, 200);

  const categoryName = `Admin Category ${schema}`;
  const created = await admin.post('/new-category', { name: categoryName });
  const categoryPath = redirectPath(created, /^\/category\/\d+$/);
  assert.ok((await admin.get(categoryPath)).html.includes(categoryName));
  const countBeforeLogout = await userCount();
  const logoutCookie = admin.cookies.get('connect.sid');
  redirectPath(await admin.post('/logout', {}), '/login');
  assertGuestNavigation((await admin.get('/login')).html);
  redirectPath(await admin.get('/dashboard', { status: 303 }), '/login');
  assert.ok(admin.cookies.get('connect.sid') !== logoutCookie, 'Logout invalidates the authenticated session');
  assert.equal(await userCount(), countBeforeLogout);

  await client.query('ALTER TABLE users RENAME TO unavailable_users');
  try {
    const failure = await guest.post('/register', { name: 'Failure User', email: 'failure@example.com', password: 'failure!' }, { status: 500 });
    assert.ok(failure.html.includes('We could not complete this request.'));
    assert.ok(!failure.html.includes('unavailable_users'));
  } finally {
    await client.query('ALTER TABLE unavailable_users RENAME TO users');
  }
  assert.equal((await guest.get('/login')).response.status, 200);
  console.log('All W05 authentication, authorization, registration, session, and role checks passed.');
} catch (error) {
  console.error('W05 verification failed:', error.message);
  if (serverErrors) console.error('Server errors:', serverErrors);
  process.exitCode = 1;
} finally {
  if (server?.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
  if (schemaCreated) {
    await client.query('ROLLBACK');
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    console.log('Removed disposable W05 verification schema.');
  }
  await client.end();
}
