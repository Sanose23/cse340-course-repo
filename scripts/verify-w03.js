import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const schema = `w03_verify_${process.pid}_${Date.now()}`;
const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const connectionString = process.env.DB_URL || process.env.DATABASE_URL;
assert.ok(connectionString, 'DB_URL or DATABASE_URL must be set');
const client = new pg.Client({ connectionString, ssl: true, connectionTimeoutMillis: 10000 });
let server;
let serverErrors = '';
let schemaCreated = false;

const request = async (baseUrl, resource, expectedStatus = 200) => {
  try {
    const response = await fetch(`${baseUrl}${resource}`, { signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    assert.equal(response.status, expectedStatus, `${resource}: HTTP ${expectedStatus}`);
    return html;
  } catch (error) {
    throw new Error(`${resource}: ${error.message}${error.cause ? ` (${error.cause.message})` : ''}`);
  }
};

try {
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  await client.query(`SET search_path TO ${schema}`);
  await client.query(await readFile(new URL('../src/setup.sql', import.meta.url), 'utf8'));

  const testUrl = new URL(connectionString);
  testUrl.searchParams.set('options', `-c search_path=${schema}`);
  const env = {
    ...process.env,
    DB_URL: testUrl.href,
    DATABASE_URL: testUrl.href,
    PORT: '0',
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    ENABLE_SQL_LOGGING: 'false',
  };
  server = spawn(process.execPath, ['server.js'], { cwd: projectDirectory, env });
  let output = '';
  server.stderr.on('data', (chunk) => { serverErrors += chunk; });
  const baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${serverErrors}`)), 30000);
    server.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${serverErrors}`));
    });
    server.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Server is running at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });

  const organizations = await request(baseUrl, '/organizations');
  assert.equal((organizations.match(/href="\/organization\/\d+"/g) || []).length, 3, 'Each organization links to details');
  const organization = await request(baseUrl, '/organization/1');
  assert.ok(organization.includes('BrightFuture Builders'), 'Organization details render');
  assert.equal((organization.match(/href="\/project\/\d+"/g) || []).length, 5, 'Organization lists five linked projects');

  const projects = await request(baseUrl, '/projects');
  assert.ok(projects.includes('<title>Upcoming Service Projects |'), 'Upcoming projects title renders');
  assert.equal((projects.match(/class="project-card"/g) || []).length, 5, 'Projects page limits results to five');
  assert.equal((projects.match(/class="card-title-link" href="\/project\/\d+"/g) || []).length, 5, 'Each project links to details');
  assert.ok(projects.includes('href="/organization/1"'), 'Projects link to organization details');

  const project = await request(baseUrl, '/project/1');
  assert.ok(project.includes('Park Cleanup') && project.includes('Riverside Park, Rexburg'), 'Project details render');
  assert.ok(project.includes('href="/organization/1"'), 'Project links to its organization');
  assert.ok(project.includes('href="/category/1"') && project.includes('href="/category/3"'), 'Project category tags link to details');

  const categories = await request(baseUrl, '/categories');
  assert.equal((categories.match(/class="card-title-link" href="\/category\/\d+"/g) || []).length, 4, 'Each category links to details');
  const category = await request(baseUrl, '/category/1');
  assert.ok(category.includes('Environmental'), 'Category details render');
  assert.ok(category.includes('href="/project/1"') && category.includes('Park Cleanup'), 'Category lists linked projects');

  const unsafe = '<script>alert("w03")</script>';
  const escaped = '&lt;script&gt;alert(&#34;w03&#34;)&lt;/script&gt;';
  const insertedCategory = await client.query('INSERT INTO category (name) VALUES ($1) RETURNING category_id', [unsafe]);
  const unsafeCategory = await request(baseUrl, `/category/${insertedCategory.rows[0].category_id}`);
  assert.ok(unsafeCategory.includes(escaped) && !unsafeCategory.includes(unsafe), 'Detail views escape database values');

  for (const route of ['/organization/not-a-number', '/organization/999999', '/project/not-a-number', '/project/999999', '/category/not-a-number', '/category/999999', '/missing-page']) {
    const html = await request(baseUrl, route, 404);
    assert.ok(html.includes('The page you are looking for does not exist.'), `${route}: custom 404 page`);
  }
  const serverError = await request(baseUrl, '/test-error', 500);
  assert.ok(serverError.includes('We could not complete this request.'), 'Custom 500 page renders');
  assert.ok(!serverError.includes('This is a test error') && !serverError.includes('server.js'), 'Production-style 500 hides details');

  await client.query('ALTER TABLE category RENAME TO unavailable_category');
  const queryFailure = await request(baseUrl, '/categories', 500);
  assert.ok(queryFailure.includes('We could not complete this request.'), 'Database failure returns custom 500 page');
  assert.ok(!queryFailure.includes('unavailable_category') && !queryFailure.includes(connectionString), 'Database failure hides internals');
  await client.query('ALTER TABLE unavailable_category RENAME TO category');
  assert.ok((await request(baseUrl, '/categories')).includes('Environmental'), 'Application recovers after query failure');

  const routeSource = await readFile(new URL('../src/routes.js', import.meta.url), 'utf8');
  const serverSource = await readFile(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(routeSource.includes("router.get('/organization/:id'") && routeSource.includes("router.get('/project/:id'") && routeSource.includes("router.get('/category/:id'"), 'Dynamic routes live in routes.js');
  assert.ok(!serverSource.includes("app.get('/organization") && !serverSource.includes("app.get('/project") && !serverSource.includes("app.get('/category"), 'Feature routes stay out of server.js');

  console.log('All W03 MVC, detail-page, relationship, escaping, and error checks passed.');
} catch (error) {
  console.error('W03 verification failed:', error.message);
  if (server) console.error('Server errors:', serverErrors || '(none)');
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
  if (schemaCreated) {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    console.log('Removed disposable W03 verification schema.');
  }
  await client.end();
}
