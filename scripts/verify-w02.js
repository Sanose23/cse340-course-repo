import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const schema = `w02_verify_${process.pid}_${Date.now()}`;
const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const connectionString = process.env.DB_URL || process.env.DATABASE_URL;
assert.ok(connectionString, 'DB_URL or DATABASE_URL must be set');
const client = new pg.Client({ connectionString, ssl: true, connectionTimeoutMillis: 10000 });
let server;
let schemaCreated = false;

const runCheck = async (args, env) => {
  const child = spawn(process.execPath, args, { cwd: projectDirectory, env, stdio: 'inherit' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, 'HTTP verification script succeeds');
};

try {
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  await client.query(`SET search_path TO ${schema}`);
  await client.query(await readFile(new URL('../src/setup.sql', import.meta.url), 'utf8'));

  const counts = await client.query(`
    SELECT (SELECT COUNT(*)::int FROM organization) AS organizations,
           (SELECT COUNT(*)::int FROM project) AS projects,
           (SELECT COUNT(*)::int FROM category) AS categories,
           (SELECT COUNT(*)::int FROM project_category) AS links;
  `);
  assert.deepEqual(counts.rows[0], { organizations: 3, projects: 15, categories: 4, links: 24 });
  const sponsors = await client.query(`
    SELECT o.organization_id, COUNT(p.project_id)::int AS projects
    FROM organization o LEFT JOIN project p USING (organization_id)
    GROUP BY o.organization_id ORDER BY o.organization_id;
  `);
  assert.ok(sponsors.rows.every((row) => row.projects >= 5), 'Five projects per organization');
  const uncategorized = await client.query(`
    SELECT p.project_id FROM project p
    LEFT JOIN project_category pc USING (project_id)
    WHERE pc.category_id IS NULL;
  `);
  assert.equal(uncategorized.rowCount, 0, 'Every project has a category');
  const unused = await client.query(`
    SELECT c.category_id FROM category c
    LEFT JOIN project_category pc USING (category_id)
    WHERE pc.project_id IS NULL;
  `);
  assert.equal(unused.rowCount, 0, 'Every category has a project');
  const multiple = await client.query(`
    SELECT project_id FROM project_category GROUP BY project_id HAVING COUNT(*) > 1;
  `);
  assert.ok(multiple.rowCount > 0, 'Multiple categories per project are supported');

  await assert.rejects(client.query('INSERT INTO project_category VALUES (1, 1)'), { code: '23505' });
  await assert.rejects(client.query('INSERT INTO project_category VALUES (999999, 1)'), { code: '23503' });
  await assert.rejects(client.query('INSERT INTO project_category VALUES (1, 999999)'), { code: '23503' });
  await assert.rejects(client.query('INSERT INTO category (name) VALUES (NULL)'), { code: '23502' });
  await assert.rejects(client.query("INSERT INTO category (name) VALUES ('Environmental')"), { code: '23505' });
  await assert.rejects(client.query(`
    INSERT INTO project (organization_id, title, description, location, date)
    VALUES (999999, 'Invalid sponsor', 'Test', 'Test', '2026-11-01');
  `), { code: '23503' });
  await assert.rejects(client.query('DELETE FROM organization WHERE organization_id = 1'), { code: '23503' });
  console.log('PASS PostgreSQL setup, seed counts, relationships, required fields, and constraints');

  const testUrl = new URL(connectionString);
  testUrl.searchParams.set('options', `-c search_path=${schema}`);
  const env = {
    ...process.env, DB_URL: testUrl.href, DATABASE_URL: testUrl.href,
    PORT: '0', HOST: '127.0.0.1', NODE_ENV: 'test', ENABLE_SQL_LOGGING: 'false',
  };
  server = spawn(process.execPath, ['server.js'], { cwd: projectDirectory, env });
  let output = '';
  let errors = '';
  server.stderr.on('data', (chunk) => { errors += chunk; });
  const baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${errors}`)), 30000);
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${errors}`)); });
    server.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Server is running at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  await runCheck(['scripts/verify.js', baseUrl], env);

  const unsafe = '<script>alert("w02")</script>';
  const escaped = '&lt;script&gt;alert(&#34;w02&#34;)&lt;/script&gt;';
  const category = await client.query('INSERT INTO category (name) VALUES ($1) RETURNING category_id', [`New ${unsafe}`]);
  const organization = await client.query(`
    INSERT INTO organization (name, description, contact_email, logo_filename)
    VALUES ($1, $2, $3, $4) RETURNING organization_id;
  `, [`New ${unsafe}`, 'New database description', 'new@example.test', 'unityserve-logo.png']);
  const project = await client.query(`
    INSERT INTO project (organization_id, title, description, location, date)
    VALUES ($1, $2, $3, $4, $5) RETURNING project_id;
  `, [organization.rows[0].organization_id, `New ${unsafe}`, 'New project description', 'New test location', '2027-01-02']);
  await client.query('INSERT INTO project_category VALUES ($1, $2)', [project.rows[0].project_id, category.rows[0].category_id]);

  for (const route of [
    '/',
    '/organizations',
    `/organization/${organization.rows[0].organization_id}`,
    '/categories',
    `/category/${category.rows[0].category_id}`,
  ]) {
    const response = await fetch(`${baseUrl}${route}`, { signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    assert.equal(response.status, 200, `${route}: dynamic data renders`);
    assert.ok(html.includes(escaped) && !html.includes(unsafe), `${route}: new database names are escaped`);
  }
  const newProject = await fetch(`${baseUrl}/project/${project.rows[0].project_id}`, { signal: AbortSignal.timeout(15000) });
  const newProjectHtml = await newProject.text();
  assert.equal(newProject.status, 200, 'New project detail renders');
  assert.ok(newProjectHtml.includes(escaped) && !newProjectHtml.includes(unsafe), 'New project data is escaped');
  assert.ok(newProjectHtml.includes('January 2, 2027') && newProjectHtml.includes('New test location'), 'New date and location render');
  console.log('PASS newly inserted database records flow through models, routes, and EJS safely');

  await client.query('ALTER TABLE category RENAME TO unavailable_category');
  const failure = await fetch(`${baseUrl}/categories`, { signal: AbortSignal.timeout(15000) });
  const failureHtml = await failure.text();
  assert.equal(failure.status, 500, 'Query failure returns HTTP 500');
  assert.ok(failureHtml.includes('We could not complete this request'), 'Query failure displays a useful error page');
  assert.ok(!failureHtml.includes('unavailable_category') && !failureHtml.includes(connectionString), 'Error page hides database details');
  await client.query('ALTER TABLE unavailable_category RENAME TO category');
  assert.equal((await fetch(`${baseUrl}/categories`)).status, 200, 'Application recovers after query failure');
  console.log('PASS database query failure and recovery');

  await client.query('DELETE FROM project');
  assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM project_category')).rows[0].count, 0, 'Deleting projects removes junction links');
  await client.query('DELETE FROM organization');
  await client.query('DELETE FROM category');
  for (const route of ['/', '/organizations', '/projects', '/categories']) {
    const response = await fetch(`${baseUrl}${route}`, { signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    assert.equal(response.status, 200, `${route}: empty data renders`);
    if (route !== '/') assert.ok(html.includes('available yet.'), `${route}: empty-state message`);
  }
  console.log('PASS empty database results and junction cleanup');
  console.log('All W02 database and application checks passed.');
} catch (error) {
  console.error('W02 verification failed:', error.message);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
  if (schemaCreated) {
    await client.query('ROLLBACK');
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    console.log('Removed disposable verification schema.');
  }
  await client.end();
}
