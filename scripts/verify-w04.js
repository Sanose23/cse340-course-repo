import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import pg from 'pg';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const token = randomBytes(8).toString('hex');
const schema = `w04_verify_${process.pid}_${token}`;
const applicationName = `w04_server_${token}`;
const sessionSecret = randomBytes(48).toString('hex');
const interrupted = new AbortController();
const interrupt = () => interrupted.abort(new Error('W04 verification interrupted'));
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
const connectionString = process.env.DB_URL || process.env.DATABASE_URL;
const integerMaximum = 2147483647;
const validationMessage = /required|between|characters|valid|select/i;
const duplicateMessage = /already|exists|duplicate|taken|unique/i;
const successMessage = /success|created|added|updated|saved|assigned/i;
const identifierColumns = { organization: 'organization_id', project: 'project_id', category: 'category_id' };
const detailPaths = { organization: 'organization', project: 'project', category: 'category' };
const listPaths = { organization: 'organizations', project: 'projects', category: 'categories' };
let client;
let connected = false;
let schemaAttempted = false;
let server;
let serverErrors = '';
let testDatabaseUrl;
let baseUrl;
let stage = 'configuration';
let assertionsOfInvalidSubmissions = 0;

const safeMessage = (error) => {
  let message = String(error?.message || error);
  for (const value of [connectionString, testDatabaseUrl?.href, sessionSecret]) {
    if (value) message = message.split(value).join('[private configuration hidden]');
  }
  return message.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[database URL hidden]');
};

const localHostname = (hostname) => hostname.replace(/^\[|\]$/g, '').toLowerCase();
const isLocal = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(localHostname(hostname));
const quoteIdentifier = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sortedIds = (values) => [...new Set(values.map(Number))].sort((left, right) => left - right);

const decodeHtml = (value) => String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  if (code[0] !== '#') return named[code.toLowerCase()] || entity;
  const number = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
  return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
});

const textContent = (html) => decodeHtml(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const attributes = (source) => {
  const result = {};
  for (const match of source.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result[match[1].toLowerCase()] = match[2] !== undefined || match[3] !== undefined || match[4] !== undefined
      ? decodeHtml(match[2] ?? match[3] ?? match[4])
      : true;
  }
  return result;
};

const flashMessages = (html, type) => {
  const messages = [];
  let coveredUntil = -1;
  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^<>]*)>/gi)) {
    if (match.index < coveredUntil) continue;
    const attrs = attributes(match[2]);
    const classes = String(attrs.class || '');
    const typedClass = new RegExp(`(?:^|[\\s_-])${type}(?:$|[\\s_-])`, 'i').test(classes);
    const alert = type === 'error' && attrs.role === 'alert' && !/(?:^|[\s_-])success(?:$|[\s_-])/i.test(classes);
    if (!typedClass && !alert) continue;
    const closing = new RegExp(`</${escapeRegex(match[1])}\\s*>`, 'gi');
    closing.lastIndex = match.index + match[0].length;
    const end = closing.exec(html);
    if (!end) continue;
    const text = textContent(html.slice(match.index + match[0].length, end.index));
    if (text) messages.push(text);
    coveredUntil = end.index + end[0].length;
  }
  return messages;
};

const formFrom = (html, actions) => {
  const allowed = Array.isArray(actions) ? actions : [actions];
  const forms = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi)].map((match) => ({
    attrs: attributes(match[1]),
    html: match[2],
  }));
  const candidates = forms.filter((form) => allowed.includes(form.attrs.action));
  assert.equal(candidates.length, 1, `${allowed.join(' or ')}: one correctly targeted, closed form`);
  const form = candidates[0];
  assert.equal(String(form.attrs.method).toLowerCase(), 'post', `${allowed[0]}: form uses POST`);
  assert.ok(!('novalidate' in form.attrs), `${allowed[0]}: browser validation is enabled`);
  assert.ok(!/<(?:button|input)\b[^>]*\sformnovalidate(?:\s|=|>)/i.test(form.html), `${allowed[0]}: submit controls preserve browser validation`);
  assert.ok(/<button\b(?=[^>]*\btype\s*=\s*["']?submit\b)[^>]*>|<input\b(?=[^>]*\btype\s*=\s*["']?submit\b)[^>]*>|<button\b(?![^>]*\btype\s*=)[^>]*>/i.test(form.html), `${allowed[0]}: submit control exists`);
  form.controls = [];
  for (const match of form.html.matchAll(/<input\b([^>]*)>/gi)) form.controls.push({ tag: 'input', attrs: attributes(match[1]), html: '' });
  for (const tag of ['textarea', 'select']) {
    for (const match of form.html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}\\s*>`, 'gi'))) {
      form.controls.push({ tag, attrs: attributes(match[1]), html: match[2] });
    }
  }
  form.labels = [...form.html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label\s*>/gi)].map((match) => ({ attrs: attributes(match[1]), text: textContent(match[2]) }));
  const ids = form.controls.filter((control) => control.attrs.id).map((control) => control.attrs.id);
  assert.equal(new Set(ids).size, ids.length, `${allowed[0]}: form control IDs are unique`);
  assert.ok(/<h1\b/i.test(html) && /<main\b/i.test(html), `${allowed[0]}: form page has a main region and heading`);
  assert.ok(!html.includes('<%'), `${allowed[0]}: no unrendered EJS`);
  return form;
};

const controlFrom = (form, name) => {
  const matches = form.controls.filter((control) => control.attrs.name === name);
  assert.equal(matches.length, 1, `${form.attrs.action}: one ${name} control`);
  return matches[0];
};

const optionsFrom = (control) => [...control.html.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option\s*>/gi)].map((match) => ({
  attrs: attributes(match[1]),
  text: textContent(match[2]),
}));

const valueFrom = (control) => {
  if (control.tag === 'textarea') return decodeHtml(control.html);
  if (control.tag === 'select') {
    const options = optionsFrom(control);
    return String((options.find((option) => 'selected' in option.attrs) || options[0])?.attrs.value ?? '');
  }
  return String(control.attrs.value ?? '');
};

const formRules = (kind, editing) => {
  if (kind === 'organization') return {
    name: { tag: 'input', type: 'text', maximum: 150 },
    description: { tag: 'textarea', maximum: 500 },
    contactEmail: { tag: 'input', type: 'email', maximum: 255 },
    ...(editing ? { logoFilename: { tag: 'input', type: 'text', maximum: 255 } } : {}),
  };
  if (kind === 'project') return {
    title: { tag: 'input', type: 'text', maximum: 200 },
    description: { tag: 'textarea', maximum: 500 },
    location: { tag: 'input', type: 'text', maximum: 200 },
    date: { tag: 'input', type: 'date' },
    organizationId: { tag: 'select' },
  };
  return { name: { tag: 'input', type: 'text', maximum: 100 } };
};

const snapshot = async () => {
  const result = await client.query(`
    SELECT
      COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.organization_id) FROM organization AS o), '[]'::jsonb) AS organization,
      COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.project_id) FROM project AS p), '[]'::jsonb) AS project,
      COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.category_id) FROM category AS c), '[]'::jsonb) AS category,
      COALESCE((SELECT jsonb_agg(to_jsonb(pc) ORDER BY pc.project_id, pc.category_id) FROM project_category AS pc), '[]'::jsonb) AS project_category
  `);
  return result.rows[0];
};

const entityFrom = (state, table, id) => state[table].find((row) => row[identifierColumns[table]] === Number(id));
const assignmentsFrom = (state, projectId) => sortedIds(state.project_category.filter((row) => row.project_id === Number(projectId)).map((row) => row.category_id));

const assertOnlyEntityChanged = (before, after, table, id, inserting) => {
  const key = identifierColumns[table];
  for (const name of Object.keys(before)) {
    if (name !== table) assert.deepEqual(after[name], before[name], `${table} mutation does not change ${name}`);
  }
  assert.deepEqual(after[table].filter((row) => row[key] !== id), before[table].filter((row) => row[key] !== id), `${table} mutation leaves every unrelated row unchanged`);
  assert.equal(after[table].length, before[table].length + (inserting ? 1 : 0), `${table} mutation changes only the expected row count`);
  assert.ok(entityFrom(after, table, id), `${table} target exists after mutation`);
  assert.equal(Boolean(entityFrom(before, table, id)), !inserting, `${table} target has the expected previous existence`);
};

const assertOnlyAssignmentsChanged = (before, after, projectId, expected) => {
  for (const name of ['organization', 'project', 'category']) assert.deepEqual(after[name], before[name], `Category assignment leaves ${name} records unchanged`);
  assert.deepEqual(after.project_category.filter((row) => row.project_id !== projectId), before.project_category.filter((row) => row.project_id !== projectId), 'Category assignment leaves unrelated projects unchanged');
  if (expected) assert.deepEqual(assignmentsFrom(after, projectId), sortedIds(expected), 'Target project has exactly the requested category set');
};

const verifyForm = async (html, resource, kind, { row, selectedCategories } = {}) => {
  const editing = resource.startsWith('/edit-');
  const assignment = kind === 'assignment';
  const projectId = assignment ? Number(resource.match(/\d+/)?.[0]) : undefined;
  const actions = assignment ? [`/assign-categories/${projectId}`, `/project/${projectId}/assign-categories`] : [resource];
  const form = formFrom(html, actions);
  const state = await snapshot();
  if (assignment) {
    const checkboxes = form.controls.filter((control) => control.attrs.name === 'categoryIds');
    assert.equal(checkboxes.length, state.category.length, `${resource}: every category has a checkbox`);
    const ids = [];
    for (const control of checkboxes) {
      assert.equal(control.tag, 'input', `${resource}: category selection is an input`);
      assert.equal(control.attrs.type, 'checkbox', `${resource}: category selection uses checkboxes`);
      assert.ok(!('required' in control.attrs), `${resource}: zero selections are allowed`);
      assert.ok(/^\d+$/.test(control.attrs.value), `${resource}: checkbox value is a category ID`);
      const category = entityFrom(state, 'category', control.attrs.value);
      assert.ok(category, `${resource}: checkbox corresponds to an existing category`);
      const label = form.labels.find((item) => item.attrs.for === control.attrs.id);
      assert.ok(control.attrs.id && label?.text, `${resource}: category checkbox has an explicit label`);
      assert.equal(label.text, category.name, `${resource}: category label uses its database name`);
      ids.push(Number(control.attrs.value));
    }
    assert.equal(new Set(ids).size, ids.length, `${resource}: category checkbox values are unique`);
    if (selectedCategories) assert.deepEqual(sortedIds(checkboxes.filter((control) => 'checked' in control.attrs).map((control) => control.attrs.value)), sortedIds(selectedCategories), `${resource}: existing selections are checked`);
    assert.ok(!form.controls.some((control) => control.attrs.name && control.attrs.name !== 'categoryIds' && !['hidden', 'submit', 'button'].includes(control.attrs.type)), `${resource}: checkbox field name is categoryIds`);
    return form;
  }
  const rules = formRules(kind, editing);
  for (const [name, rule] of Object.entries(rules)) {
    const control = controlFrom(form, name);
    assert.equal(control.tag, rule.tag, `${resource}: ${name} uses the correct form element`);
    if (rule.type) assert.equal(control.attrs.type, rule.type, `${resource}: ${name} input type`);
    assert.ok('required' in control.attrs, `${resource}: ${name} is required in HTML`);
    if (rule.maximum) assert.equal(Number(control.attrs.maxlength), rule.maximum, `${resource}: ${name} client maximum length`);
    assert.ok(!('minlength' in control.attrs), `${resource}: ${name} leaves minimum length checks to the server`);
    assert.ok(!('disabled' in control.attrs), `${resource}: ${name} can be submitted`);
    assert.ok(control.attrs.id && form.labels.some((label) => label.attrs.for === control.attrs.id && label.text), `${resource}: ${name} has an explicit, nonempty label`);
  }
  const visibleNames = form.controls.filter((control) => control.attrs.name && !['hidden', 'submit', 'button'].includes(control.attrs.type)).map((control) => control.attrs.name);
  assert.deepEqual([...new Set(visibleNames)].sort(), Object.keys(rules).sort(), `${resource}: exact form field names`);
  if (kind === 'project') {
    const organizationControl = controlFrom(form, 'organizationId');
    const options = optionsFrom(organizationControl);
    assert.ok(options.some((option) => option.attrs.value === ''), `${resource}: organization dropdown includes an empty choice`);
    const populated = options.filter((option) => option.attrs.value !== '');
    assert.deepEqual(sortedIds(populated.map((option) => option.attrs.value)), sortedIds(state.organization.map((organization) => organization.organization_id)), `${resource}: dropdown includes every organization`);
    for (const option of populated) assert.equal(option.text, entityFrom(state, 'organization', option.attrs.value)?.name, `${resource}: dropdown labels match organization data`);
    if (row) {
      const selected = options.filter((option) => 'selected' in option.attrs);
      assert.equal(selected.length, 1, `${resource}: one organization is explicitly selected`);
      assert.equal(selected[0].attrs.value, String(row.organization_id), `${resource}: existing organization is selected`);
    }
  }
  if (row) {
    const expected = kind === 'organization'
      ? { name: row.name, description: row.description, contactEmail: row.contact_email, logoFilename: row.logo_filename }
      : kind === 'project'
        ? { title: row.title, description: row.description, location: row.location, date: row.date, organizationId: String(row.organization_id) }
        : { name: row.name };
    for (const [name, value] of Object.entries(expected)) assert.equal(valueFrom(controlFrom(form, name)), value, `${resource}: ${name} is pre-populated from the database`);
  }
  return form;
};

class Browser {
  constructor() {
    this.cookies = new Map();
  }

  async request(resource, { method = 'GET', body, json = false, status = 200, binary = false, timeout = 20000 } = {}) {
    const url = new URL(resource, baseUrl);
    assert.equal(url.origin, baseUrl, 'Verifier requests must stay on its disposable local server');
    const headers = new Headers({ Accept: binary ? '*/*' : 'text/html' });
    const cookies = [...this.cookies.entries()].filter(([, cookie]) => cookie.expires > Date.now() && url.pathname.startsWith(cookie.path));
    if (cookies.length) headers.set('Cookie', cookies.map(([name, cookie]) => `${name}=${cookie.value}`).join('; '));
    let encodedBody;
    if (body !== undefined) {
      if (json) {
        headers.set('Content-Type', 'application/json');
        encodedBody = JSON.stringify(body);
      } else {
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
        const values = new URLSearchParams();
        for (const [name, value] of Object.entries(body)) {
          if (value === undefined) continue;
          for (const item of Array.isArray(value) ? value : [value]) values.append(name, String(item));
        }
        encodedBody = values.toString();
      }
    }
    const response = await fetch(url, { method, headers, body: encodedBody, redirect: 'manual', signal: AbortSignal.any([interrupted.signal, AbortSignal.timeout(timeout)]) });
    const setCookies = response.headers.getSetCookie?.() || (response.headers.get('set-cookie') || '').split(/,(?=\s*[^\s;,]+=)/).filter(Boolean);
    for (const cookie of setCookies) {
      const pieces = cookie.split(';').map((piece) => piece.trim());
      const separator = pieces[0].indexOf('=');
      if (separator < 1) continue;
      const name = pieces[0].slice(0, separator);
      const value = pieces[0].slice(separator + 1);
      const properties = Object.fromEntries(pieces.slice(1).map((piece) => {
        const index = piece.indexOf('=');
        return index === -1 ? [piece.toLowerCase(), true] : [piece.slice(0, index).toLowerCase(), piece.slice(index + 1)];
      }));
      const expires = properties['max-age'] !== undefined
        ? Date.now() + Number(properties['max-age']) * 1000
        : properties.expires ? Date.parse(properties.expires) : Infinity;
      if (!value || expires <= Date.now()) this.cookies.delete(name);
      else this.cookies.set(name, { value, path: properties.path || '/', expires });
    }
    const bytes = binary ? Buffer.from(await response.arrayBuffer()) : undefined;
    const html = binary ? undefined : await response.text();
    assert.equal(response.status, status, `${method} ${url.pathname}: HTTP ${status}`);
    if (!binary && method !== 'HEAD' && status >= 200 && status < 300) assert.match(response.headers.get('content-type') || '', /text\/html|text\/css|image\/svg\+xml/i, `${method} ${url.pathname}: response content type`);
    return { html, bytes, headers: response.headers, status: response.status, location: response.headers.get('location'), resource: url.pathname };
  }

  get(resource, options = {}) {
    return this.request(resource, options);
  }

  post(resource, body, options = {}) {
    return this.request(resource, { ...options, method: 'POST', body, status: options.status ?? 303 });
  }
}

const redirectDestination = (response, allowed) => {
  assert.ok(response.location, `${response.resource}: redirect has a Location header`);
  const url = new URL(response.location, baseUrl);
  assert.equal(url.origin, baseUrl, `${response.resource}: redirect stays local`);
  assert.ok(!url.search && !url.hash, `${response.resource}: state is stored in the session, not the redirect URL`);
  if (allowed) assert.ok(allowed.includes(url.pathname), `${response.resource}: redirect uses the expected destination`);
  return url.pathname;
};

const renderFlashOnce = async (browser, destination, type, pattern) => {
  const first = await browser.get(destination);
  const messages = flashMessages(first.html, type);
  assert.ok(messages.length, `${destination}: ${type} feedback survives the redirect`);
  assert.match(messages.join(' '), pattern, `${destination}: useful ${type} feedback`);
  const second = await browser.get(destination);
  assert.equal(flashMessages(second.html, type).length, 0, `${destination}: ${type} feedback is consumed by one render only`);
  return first.html;
};

const successfulMutation = async (browser, resource, body, table, expected, { id, json = false, render = true } = {}) => {
  const before = await snapshot();
  const response = await browser.post(resource, body, { json });
  const after = await snapshot();
  const inserting = id === undefined;
  if (inserting) {
    const added = after[table].filter((row) => !entityFrom(before, table, row[identifierColumns[table]]));
    assert.equal(added.length, 1, `${resource}: one database record is created`);
    id = added[0][identifierColumns[table]];
  }
  assert.ok(Number.isInteger(id) && id > 0 && id <= integerMaximum, `${resource}: valid resulting database ID`);
  assertOnlyEntityChanged(before, after, table, id, inserting);
  const row = entityFrom(after, table, id);
  for (const [column, value] of Object.entries(expected)) assert.deepEqual(row[column], value, `${resource}: persisted ${column}`);
  const detail = `/${detailPaths[table]}/${id}`;
  const destination = redirectDestination(response, [detail, `/${listPaths[table]}`]);
  const html = render ? await renderFlashOnce(browser, destination, 'success', successMessage) : undefined;
  if (render) assert.deepEqual(await snapshot(), after, `${resource}: following and refreshing the redirect never repeats the mutation`);
  return { id, row, html, destination, response };
};

const invalidSubmission = async (browser, resource, body, kind, { json = false, pattern = validationMessage } = {}) => {
  const before = await snapshot();
  const response = await browser.post(resource, body, { json });
  const projectId = kind === 'assignment' ? Number(resource.match(/\d+/)?.[0]) : undefined;
  const allowed = kind === 'assignment' ? [`/assign-categories/${projectId}`, `/project/${projectId}/assign-categories`] : [resource];
  const destination = redirectDestination(response, allowed);
  assert.deepEqual(await snapshot(), before, `${resource}: invalid submission changes no application records`);
  const html = await renderFlashOnce(browser, destination, 'error', pattern);
  assert.equal(flashMessages(html, 'success').length, 0, `${resource}: invalid submission never reports success`);
  const form = await verifyForm(html, destination, kind);
  if (kind !== 'assignment') {
    for (const name of Object.keys(formRules(kind, resource.startsWith('/edit-')))) {
      if (typeof body[name] !== 'string') continue;
      const control = controlFrom(form, name);
      const value = body[name].trim();
      if (control.tag === 'select' && !optionsFrom(control).some((option) => option.attrs.value === value)) continue;
      assert.equal(valueFrom(control), value, `${resource}: submitted ${name} is retained through the redirect`);
      if (/[<>&"']/.test(value)) assert.ok(html.includes(ejs.escapeXML(value)), `${resource}: retained ${name} is HTML-escaped`);
    }
  } else {
    const supplied = Array.isArray(body.categoryIds) ? body.categoryIds : [body.categoryIds];
    const valid = supplied.filter((value) => typeof value === 'string' && /^\d+$/.test(value) && entityFrom(before, 'category', value));
    for (const id of valid) assert.ok(form.controls.some((control) => control.attrs.name === 'categoryIds' && control.attrs.value === id && 'checked' in control.attrs), `${resource}: valid submitted category selections are retained`);
  }
  assert.deepEqual(await snapshot(), before, `${resource}: error renders and refreshes change no application records`);
  assertionsOfInvalidSubmissions += 1;
  return html;
};

const assignmentMutation = async (browser, resource, body, projectId, expected, { json = false, render = true, timeout = 20000 } = {}) => {
  const before = await snapshot();
  const response = await browser.post(resource, body, { json, timeout });
  const after = await snapshot();
  assertOnlyAssignmentsChanged(before, after, projectId, expected);
  const destination = redirectDestination(response, [`/project/${projectId}`]);
  const html = render ? await renderFlashOnce(browser, destination, 'success', successMessage) : undefined;
  if (render) {
    const formHtml = (await browser.get(`/assign-categories/${projectId}`)).html;
    await verifyForm(formHtml, `/assign-categories/${projectId}`, 'assignment', { selectedCategories: expected });
    for (const category of after.category) assert.equal(html.includes(`href="/category/${category.category_id}"`), sortedIds(expected).includes(category.category_id), 'Project detail category links match the replacement set');
    assert.deepEqual(await snapshot(), after, 'Category assignment redirects and refreshes do not mutate records');
  }
  return { response, destination, html, after };
};

const assertEscaped = (html, values, label) => {
  for (const value of values) {
    assert.ok(html.includes(ejs.escapeXML(value)), `${label}: raw data is escaped exactly at output`);
    assert.ok(!html.includes(value), `${label}: unsafe raw markup is not emitted`);
    assert.ok(!html.includes(ejs.escapeXML(ejs.escapeXML(value))), `${label}: data is not double-escaped`);
  }
};

const assertServerError = (html, privateValues = []) => {
  assert.match(textContent(html), /could not complete|temporarily unavailable|try again|service.*unavailable/i, 'Server failures use the custom, helpful 500 page');
  for (const value of [...privateValues, schema, connectionString, testDatabaseUrl.href, sessionSecret, 'server.js', 'node_modules/', 'This is a test error']) {
    if (value) assert.ok(!html.includes(value), 'Server failure response hides private data and implementation details');
  }
  assert.ok(!/\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b|\bat\s+\w+\s*\([^)]*:\d+:\d+\)/i.test(html), 'Server failure response hides SQL and stack traces');
};

const runStage = async (label, operation) => {
  stage = label;
  interrupted.signal.throwIfAborted();
  await operation();
  console.log(`PASS ${label}`);
};

const compileViewsAndVerifySources = async () => {
  const viewDirectory = path.join(projectDirectory, 'src/views');
  const visit = async (directory) => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await visit(filename));
      else if (entry.isFile() && entry.name.endsWith('.ejs')) files.push(filename);
    }
    return files;
  };
  const views = await visit(viewDirectory);
  assert.ok(views.length >= 7, 'EJS views are present');
  for (const filename of views) ejs.compile(await readFile(filename, 'utf8'), { filename });
  const routes = await readFile(path.join(projectDirectory, 'src/routes.js'), 'utf8');
  const serverSource = await readFile(path.join(projectDirectory, 'server.js'), 'utf8');
  const features = ['/new-organization', '/edit-organization/:id', '/new-project', '/edit-project/:id', '/new-category', '/edit-category/:id', '/assign-categories/:projectId', '/project/:projectId/assign-categories'];
  for (const feature of features) {
    assert.ok(routes.includes(feature), `${feature}: feature is registered in the route module`);
    assert.ok(!new RegExp(`app\\s*\\.\\s*(?:get|post|route)\\s*\\(\\s*['"]${escapeRegex(feature)}['"]`).test(serverSource), `${feature}: feature route is not defined in server.js`);
  }
  const modelFunctions = {
    organizations: ['createOrganization', 'updateOrganization'],
    projects: ['createProject', 'updateProject'],
    categories: ['createCategory', 'updateCategory', 'updateCategoryAssignments'],
  };
  let stateSources = serverSource;
  for (const [module, names] of Object.entries(modelFunctions)) {
    const model = await readFile(path.join(projectDirectory, `src/models/${module}.js`), 'utf8');
    const controller = await readFile(path.join(projectDirectory, `src/controllers/${module}.js`), 'utf8');
    stateSources += controller;
    for (const name of names) {
      assert.ok(new RegExp(`\\b(?:function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=)`).test(model), `${name}: named function is defined in its model`);
      assert.ok(new RegExp(`export\\s+(?:\\{[^}]*\\b${name}\\b|(?:async\\s+)?function\\s+${name}\\b|(?:const|let)\\s+${name}\\b)`, 's').test(model), `${name}: model function is exported`);
      assert.ok(new RegExp(`\\b${name}\\s*\\(`).test(controller), `${name}: controller delegates mutation to the model`);
    }
    assert.ok(/\$\d+/.test(model), `${module}: database values use SQL parameters`);
    assert.ok(!/\b(?:db|pool|client)\s*\.\s*(?:query|connect)\s*\(/.test(controller), `${module}: controllers contain no direct database operations`);
    assert.ok(!/from\s*['"](?:pg|[^'"]*models\/db\.js)['"]/.test(controller), `${module}: controllers do not import the database driver or pool`);
    if (module === 'categories') {
      for (const command of ['BEGIN', 'COMMIT', 'ROLLBACK']) assert.ok(new RegExp(`\\b${command}\\b`, 'i').test(model), `Category replacement explicitly uses ${command}`);
      assert.ok(/\bFOR\s+UPDATE\b/i.test(model), 'Category replacement locks the project row for serialization');
      const acquired = model.match(/\b(?:const|let)\s+([\w$]+)\s*=\s*await\s+[\w$.]+\.connect\s*\(/);
      assert.ok(acquired, 'Category replacement acquires a dedicated database client');
      assert.ok(new RegExp(`\\b${escapeRegex(acquired[1])}\\s*\\.\\s*query\\s*\\(`).test(model), 'Category replacement queries through the acquired client');
      assert.ok(new RegExp(`\\b${escapeRegex(acquired[1])}\\s*\\.\\s*release\\s*\\(`).test(model), 'Category replacement releases the acquired client');
    }
  }
  const utilityDirectory = path.join(projectDirectory, 'src/utilities');
  for (const entry of await readdir(utilityDirectory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) stateSources += await readFile(path.join(utilityDirectory, entry.name), 'utf8');
  }
  assert.ok(/req\s*\.\s*session\b/.test(stateSources), 'Form state is stored in the request session');
};

const startServer = async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: projectDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DB_URL: testDatabaseUrl.href,
      DATABASE_URL: testDatabaseUrl.href,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '0',
      SESSION_SECRET: sessionSecret,
      ENABLE_SQL_LOGGING: 'false',
    },
  });
  server.stderr.on('data', (chunk) => { serverErrors = (serverErrors + chunk.toString()).slice(-65536); });
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Local test application startup timed out')), 30000);
    server.once('error', (error) => { clearTimeout(timer); reject(error); });
    server.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Local test application exited before startup (${signal || code})`));
    });
    server.stdout.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-65536);
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (!match || Number(match[1]) === 0) return;
      clearTimeout(timer);
      resolve(`http://127.0.0.1:${match[1]}`);
    });
  });
};

const stopServer = async () => {
  if (!server?.pid || server.exitCode !== null || server.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const force = setTimeout(() => server.kill('SIGKILL'), 5000);
    const timeout = setTimeout(() => reject(new Error('Could not stop the disposable test application')), 10000);
    server.once('exit', () => { clearTimeout(force); clearTimeout(timeout); resolve(); });
    server.kill('SIGTERM');
  });
};

const runVerification = async () => {
  assert.ok(connectionString, 'Set DB_URL or DATABASE_URL to a local test PostgreSQL database');
  const databaseUrl = new URL(connectionString);
  assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol), 'A PostgreSQL connection URL is required');
  assert.ok(isLocal(databaseUrl.hostname), 'W04 verification refuses nonlocal databases; use localhost, 127.0.0.1, or ::1');
  for (const parameter of ['host', 'hostaddr', 'service']) assert.ok(!databaseUrl.searchParams.has(parameter), 'Database URL must not override its local hostname through query parameters');
  testDatabaseUrl = new URL(databaseUrl.href);
  testDatabaseUrl.searchParams.set('options', `-c search_path=${schema}`);
  testDatabaseUrl.searchParams.set('application_name', applicationName);
  client = new pg.Client({ connectionString: databaseUrl.href, ssl: false, connectionTimeoutMillis: 10000, query_timeout: 15000 });
  client.on('error', (error) => interrupted.abort(error));
  assert.ok(isLocal(client.connectionParameters.host), 'Parsed PostgreSQL connection must target a local hostname');
  stage = 'disposable local schema and course SQL seed';
  interrupted.signal.throwIfAborted();
  await client.connect();
  connected = true;
  schemaAttempted = true;
  await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}`);
  await client.query(await readFile(path.join(projectDirectory, 'src/setup.sql'), 'utf8'));
  const databaseColumns = await client.query('SELECT character_maximum_length FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3', [schema, 'project', 'title']);
  assert.equal(databaseColumns.rows[0]?.character_maximum_length, 200, 'Project schema permits the server-validated 200-character title');
  await runStage('EJS compilation and MVC source organization', compileViewsAndVerifySources);
  stage = 'local test application startup';
  interrupted.signal.throwIfAborted();
  baseUrl = await startServer();
  const browser = new Browser();
  const context = {};
  const initial = await snapshot();
  assert.ok(initial.organization.length >= 3 && initial.project.length >= 2 && initial.category.length >= 4, 'Course setup SQL seeds organizations, projects, and categories');
  const organizationBase = { name: `W04 Partner ${token}`, description: 'A local verification partner.', contactEmail: 'w04.verify@example.org' };
  const projectBase = { title: `W04 Service ${token}`, description: 'A local verification service project.', location: 'Rexburg Community Center', date: '2028-02-29', organizationId: '1' };
  const categoryBase = { name: `W04 Category ${token}` };

  await runStage('GET forms, labels, HTML limits, existing data, and discovery links', async () => {
    for (const [resource, kind] of [['/new-organization', 'organization'], ['/new-project', 'project'], ['/new-category', 'category']]) await verifyForm((await browser.get(resource)).html, resource, kind);
    for (const [resource, kind, row] of [['/edit-organization/1', 'organization', entityFrom(initial, 'organization', 1)], ['/edit-project/1', 'project', entityFrom(initial, 'project', 1)], ['/edit-category/1', 'category', entityFrom(initial, 'category', 1)]]) await verifyForm((await browser.get(resource)).html, resource, kind, { row });
    for (const resource of ['/assign-categories/1', '/project/1/assign-categories']) await verifyForm((await browser.get(resource)).html, resource, 'assignment', { selectedCategories: assignmentsFrom(initial, 1) });
    for (const table of ['organization', 'project', 'category']) {
      assert.ok((await browser.get(`/${listPaths[table]}`)).html.includes(`href="/new-${table}"`), `${table}: list page links to its create form`);
      const html = (await browser.get(`/${detailPaths[table]}/1`)).html;
      assert.ok(html.includes(`href="/edit-${table}/1"`), `${table}: detail page links to its edit form`);
      if (table === 'project') assert.ok(html.includes('href="/assign-categories/1"') || html.includes('href="/project/1/assign-categories"'), 'Project details link to category assignment');
    }
    assert.deepEqual(await snapshot(), initial, 'GET forms and navigation do not mutate application records');
  });

  await runStage('Happy create and targeted update operations with 303 PRG', async () => {
    const organization = await successfulMutation(browser, '/new-organization', { ...organizationBase, name: `  ${organizationBase.name}  `, description: `  ${organizationBase.description}  `, contactEmail: '  W04.Verify@EXAMPLE.ORG  ', id: '2', organizationId: '2', logoFilename: '../ignored.png' }, 'organization', { name: organizationBase.name, description: organizationBase.description, contact_email: 'w04.verify@example.org', logo_filename: 'placeholder-logo.png' });
    context.organizationId = organization.id;
    const placeholder = await browser.get('/images/placeholder-logo.png', { binary: true });
    assert.match(placeholder.headers.get('content-type') || '', /image\/png/i, 'New organization placeholder is a served PNG');
    assert.ok(placeholder.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Placeholder logo contains valid PNG bytes');
    const editedOrganization = { ...organizationBase, name: `Updated Partner ${token}`, description: 'Updated partner description.', contactEmail: 'edited@example.org', logoFilename: 'brightfuture-logo.png', id: '2', organizationId: '2', organization_id: '2' };
    await successfulMutation(browser, `/edit-organization/${organization.id}`, editedOrganization, 'organization', { name: editedOrganization.name, description: editedOrganization.description, contact_email: editedOrganization.contactEmail, logo_filename: editedOrganization.logoFilename }, { id: organization.id });
    const project = await successfulMutation(browser, '/new-project', { ...projectBase, title: `  ${projectBase.title}  `, description: `  ${projectBase.description}  `, location: `  ${projectBase.location}  `, organizationId: String(organization.id) }, 'project', { title: projectBase.title, description: projectBase.description, location: projectBase.location, date: projectBase.date, organization_id: organization.id });
    context.projectId = project.id;
    const editedProject = { ...projectBase, title: `Updated Service ${token}`, description: 'Updated service description.', location: 'Updated service location', date: '2028-12-12', organizationId: '2', id: '2', projectId: '2', project_id: '2' };
    const result = await successfulMutation(browser, `/edit-project/${project.id}`, editedProject, 'project', { title: editedProject.title, description: editedProject.description, location: editedProject.location, date: editedProject.date, organization_id: 2 }, { id: project.id });
    await verifyForm((await browser.get(`/edit-project/${project.id}`)).html, `/edit-project/${project.id}`, 'project', { row: result.row });
    assert.ok((await browser.get(`/project/${project.id}`)).html.includes('href="/organization/2"'), 'Project update changes the organization relationship');
    assert.ok(!(await browser.get(`/organization/${organization.id}`)).html.includes(`href="/project/${project.id}"`), 'Former organization no longer lists the moved project');
    const category = await successfulMutation(browser, '/new-category', { name: `  ${categoryBase.name}  ` }, 'category', categoryBase);
    context.categoryId = category.id;
    await successfulMutation(browser, `/edit-category/${category.id}`, { name: `Updated Category ${token}`, id: '2', categoryId: '2', category_id: '2' }, 'category', { name: `Updated Category ${token}` }, { id: category.id });
  });

  await runStage('Accepted minimum and maximum server boundaries', async () => {
    const longEmail = `${'v'.repeat(64)}@${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(57)}.org`;
    assert.equal(longEmail.length, 254, 'Email boundary fixture is a valid maximum-length RFC address');
    for (const resource of ['/new-organization', `/edit-organization/${context.organizationId}`]) {
      for (const values of [{ name: 'ABC', description: 'x', contactEmail: 'minimum@example.org' }, { name: 'O'.repeat(150), description: 'd'.repeat(500), contactEmail: longEmail }]) {
        const editing = resource.startsWith('/edit-');
        await successfulMutation(browser, resource, { ...values, ...(editing ? { logoFilename: 'unityserve-logo.png' } : {}) }, 'organization', { name: values.name, description: values.description, contact_email: values.contactEmail, logo_filename: editing ? 'unityserve-logo.png' : 'placeholder-logo.png' }, editing ? { id: context.organizationId } : {});
      }
    }
    for (const resource of ['/new-project', `/edit-project/${context.projectId}`]) {
      for (const values of [{ title: 'ABC', description: 'x', location: 'x', date: '2028-02-29' }, { title: 'T'.repeat(200), description: 'd'.repeat(1000), location: 'L'.repeat(200), date: '2028-12-31' }]) {
        const editing = resource.startsWith('/edit-');
        await successfulMutation(browser, resource, { ...values, organizationId: '1' }, 'project', { ...values, organization_id: 1 }, editing ? { id: context.projectId } : {});
      }
    }
    for (const resource of ['/new-category', `/edit-category/${context.categoryId}`]) {
      const editing = resource.startsWith('/edit-');
      for (const name of [editing ? 'XYZ' : 'ABC', `${editing ? 'E' : 'N'}${'c'.repeat(99)}`]) await successfulMutation(browser, resource, { name }, 'category', { name }, editing ? { id: context.categoryId } : {});
    }
  });

  const exerciseInvalidFields = async (resource, kind, base, specialCases) => {
    await invalidSubmission(browser, resource, {}, kind);
    for (const name of Object.keys(base)) {
      const absent = { ...base };
      delete absent[name];
      await invalidSubmission(browser, resource, absent, kind);
      for (const value of ['', ' \t\n ']) await invalidSubmission(browser, resource, { ...base, [name]: value }, kind);
      for (const value of [[base[name]], [base[name], base[name]], { value: base[name] }, null, true, 123]) await invalidSubmission(browser, resource, { ...base, [name]: value }, kind, { json: true });
      await invalidSubmission(browser, resource, { ...base, [name]: [base[name], base[name]] }, kind);
      await invalidSubmission(browser, resource, { ...absent, [`${name}[value]`]: base[name] }, kind);
    }
    for (const [name, values] of Object.entries(specialCases)) {
      for (const value of values) await invalidSubmission(browser, resource, { ...base, [name]: value }, kind);
    }
  };

  await runStage('Server rejects missing, blank, short, oversized, typed, and malformed fields', async () => {
    for (const resource of ['/new-organization', `/edit-organization/${context.organizationId}`]) {
      const editing = resource.startsWith('/edit-');
      await exerciseInvalidFields(resource, 'organization', { ...organizationBase, ...(editing ? { logoFilename: 'brightfuture-logo.png' } : {}) }, {
        name: ['a', 'ab', 'n'.repeat(151)],
        description: ['d'.repeat(501)],
        contactEmail: ['not-an-email', 'name@', 'name@example', 'name @example.org', 'name@@example.org', '<script>@example.org', 'e'.repeat(256)],
        ...(editing ? { logoFilename: ['../brightfuture-logo.png', '/images/brightfuture-logo.png', 'https://example.org/logo.png', 'missing-w04-logo.png', 'server.js', 'x'.repeat(256), 'logo.png?other=1', 'logo\\name.png'] } : {}),
      });
    }
    for (const resource of ['/new-project', `/edit-project/${context.projectId}`]) await exerciseInvalidFields(resource, 'project', projectBase, {
      title: ['a', 'ab', 't'.repeat(201)],
      description: ['d'.repeat(1001)],
      location: ['l'.repeat(201)],
      date: ['not-a-date', '2026-02-29', '2028-02-30', '2028-13-01', '2028-00-15', '2028-01-00', '2028-1-1', '12/12/2028', '2028-01-01T00:00:00Z'],
      organizationId: ['not-an-id', '0', '-1', '1.5', '1e0', '1abc', '2147483647', '2147483648', '9'.repeat(30), "1'); DROP TABLE organization; --"],
    });
    for (const resource of ['/new-category', `/edit-category/${context.categoryId}`]) await exerciseInvalidFields(resource, 'category', categoryBase, { name: ['a', 'ab', 'n'.repeat(101)] });
  });

  await runStage('Friendly category duplicate rejection on create and update', async () => {
    const existingName = entityFrom(await snapshot(), 'category', 1).name;
    for (const resource of ['/new-category', `/edit-category/${context.categoryId}`]) {
      for (const name of [existingName, `  ${existingName}  `]) await invalidSubmission(browser, resource, { name }, 'category', { pattern: duplicateMessage });
    }
    const same = entityFrom(await snapshot(), 'category', context.categoryId).name;
    await successfulMutation(browser, `/edit-category/${context.categoryId}`, { name: same }, 'category', { name: same }, { id: context.categoryId });
    const left = new Browser();
    const right = new Browser();
    const name = `Concurrent Category ${token}`;
    const before = await snapshot();
    const responses = await Promise.all([left.post('/new-category', { name }), right.post('/new-category', { name })]);
    const after = await snapshot();
    const added = after.category.filter((row) => row.name === name);
    assert.equal(added.length, 1, 'Concurrent duplicate submissions create exactly one category');
    assertOnlyEntityChanged(before, after, 'category', added[0].category_id, true);
    const destinations = responses.map((response) => redirectDestination(response));
    assert.equal(destinations.filter((destination) => destination === '/new-category').length, 1, 'Concurrent duplicate loser receives a friendly validation redirect');
    for (const [index, currentBrowser] of [left, right].entries()) {
      const failure = destinations[index] === '/new-category';
      const allowed = failure ? ['/new-category'] : [`/category/${added[0].category_id}`, '/categories'];
      assert.ok(allowed.includes(destinations[index]), 'Concurrent category result redirects to the appropriate page');
      await renderFlashOnce(currentBrowser, destinations[index], failure ? 'error' : 'success', failure ? duplicateMessage : successMessage);
    }
    assert.deepEqual(await snapshot(), after, 'Concurrent duplicate result rendering changes no database records');
  });

  await runStage('Missing, malformed, nonexistent, and out-of-range edit IDs return 404', async () => {
    const before = await snapshot();
    const validBodies = {
      organization: { ...organizationBase, logoFilename: 'brightfuture-logo.png', id: '1', organizationId: '1' },
      project: { ...projectBase, id: '1', projectId: '1' },
      category: { ...categoryBase, id: '1', categoryId: '1' },
      assignment: { categoryIds: ['1'], projectId: '1' },
    };
    const resources = [['/edit-organization', 'organization'], ['/edit-project', 'project'], ['/edit-category', 'category'], ['/assign-categories', 'assignment']];
    const ids = ['not-a-number', '0', '-1', '1.5', '1e0', '1abc', '%201%20', '%2B1', '999999', '2147483647', '2147483648', '999999999999999999999', "1%27%3BDROP%20TABLE%20project"];
    for (const [prefix, kind] of resources) {
      for (const resource of [prefix, `${prefix}/`, ...ids.map((id) => `${prefix}/${id}`)]) {
        const get = await browser.get(resource, { status: 404 });
        assert.match(textContent(get.html), /not found|does not exist|could not find/i, `${resource}: custom 404 page`);
        assert.deepEqual(await snapshot(), before, `${resource}: bad route IDs never mutate records on GET`);
        for (const body of [validBodies[kind], {}]) {
          await browser.post(resource, body, { status: 404 });
          assert.deepEqual(await snapshot(), before, `${resource}: bad route IDs never mutate a body-selected record`);
        }
      }
    }
    for (const resource of ['/project/assign-categories', '/project//assign-categories', ...ids.map((id) => `/project/${id}/assign-categories`)]) {
      await browser.get(resource, { status: 404 });
      assert.deepEqual(await snapshot(), before, `${resource}: malformed alias GET leaves records unchanged`);
      for (const body of [validBodies.assignment, {}]) {
        await browser.post(resource, body, { status: 404 });
        assert.deepEqual(await snapshot(), before, `${resource}: alias validates its project route ID before form data`);
      }
    }
  });

  await runStage('Scalar, repeated, deduplicated, empty, and aliased category replacement', async () => {
    const id = context.projectId;
    const canonical = `/assign-categories/${id}`;
    const alias = `/project/${id}/assign-categories`;
    await assignmentMutation(browser, canonical, { categoryIds: '1', projectId: '2', id: '2' }, id, [1]);
    await assignmentMutation(browser, canonical, { categoryIds: ['1', '2', '3'] }, id, [1, 2, 3]);
    await assignmentMutation(browser, canonical, { categoryIds: ['3', '3', '1', '1'] }, id, [1, 3]);
    await assignmentMutation(browser, canonical, {}, id, []);
    await assignmentMutation(browser, canonical, { categoryIds: [] }, id, [], { json: true });
    await assignmentMutation(browser, alias, { categoryIds: '2', projectId: '1', id: '1' }, id, [2]);
    await assignmentMutation(browser, alias, {}, id, []);
    await assignmentMutation(browser, canonical, { categoryIds: ['1', '3', '1'] }, id, [1, 3], { json: true });
    for (const resource of [canonical, alias]) {
      for (const categoryIds of ['not-an-id', '', '   ', '0', '-1', '1.5', '1e0', '2147483647', '2147483648', '9'.repeat(30), "1'); DROP TABLE category; --", ['1', '2147483647'], ['1', 'not-an-id']]) await invalidSubmission(browser, resource, { categoryIds }, 'assignment');
      for (const categoryIds of [{ value: '1' }, [['1']], ['1', { value: '2' }], [null], null, true]) await invalidSubmission(browser, resource, { categoryIds }, 'assignment', { json: true });
      await invalidSubmission(browser, resource, { 'categoryIds[value]': '1' }, 'assignment');
    }
  });

  await runStage('Raw database storage, SQL-safe values, and escaped form and detail output', async () => {
    const organizationValues = { name: `W04 <script>alert("name")</script> & "quote" '${token}'`, description: 'Raw </textarea><script>alert("description")</script> & "quoted" text.', contactEmail: 'escaping@example.org' };
    const organization = await successfulMutation(browser, '/new-organization', organizationValues, 'organization', { name: organizationValues.name, description: organizationValues.description, contact_email: organizationValues.contactEmail, logo_filename: 'placeholder-logo.png' });
    const projectValues = { title: `W04 <script>alert("title")</script> & '${token}'`, description: 'Raw </textarea><img src=x onerror="alert(1)"> & "quoted" text.', location: 'Raw <b>Town</b> & "Center"', date: '2028-02-29', organizationId: String(organization.id) };
    const project = await successfulMutation(browser, '/new-project', projectValues, 'project', { title: projectValues.title, description: projectValues.description, location: projectValues.location, date: projectValues.date, organization_id: organization.id });
    const categoryName = `W04 <script>alert("category")</script> & '${token}'`;
    const category = await successfulMutation(browser, '/new-category', { name: categoryName }, 'category', { name: categoryName });
    await assignmentMutation(browser, `/assign-categories/${project.id}`, { categoryIds: String(category.id) }, project.id, [category.id]);
    assertEscaped((await browser.get(`/organization/${organization.id}`)).html, [organizationValues.name, organizationValues.description, projectValues.title], 'Organization detail');
    assertEscaped((await browser.get(`/project/${project.id}`)).html, [projectValues.title, projectValues.description, projectValues.location, organizationValues.name, categoryName], 'Project detail');
    assertEscaped((await browser.get(`/category/${category.id}`)).html, [categoryName, projectValues.title, organizationValues.name], 'Category detail');
    for (const [resource, kind, row, values] of [[`/edit-organization/${organization.id}`, 'organization', organization.row, [organizationValues.name, organizationValues.description]], [`/edit-project/${project.id}`, 'project', project.row, [projectValues.title, projectValues.description, projectValues.location, organizationValues.name]], [`/edit-category/${category.id}`, 'category', category.row, [categoryName]]]) {
      const html = (await browser.get(resource)).html;
      await verifyForm(html, resource, kind, { row });
      assertEscaped(html, values, `${kind} edit form`);
    }
    assertEscaped((await browser.get('/new-project')).html, [organizationValues.name], 'Organization dropdown');
    const invalidOrganization = await invalidSubmission(browser, '/new-organization', { ...organizationValues, contactEmail: 'not-an-email' }, 'organization');
    assertEscaped(invalidOrganization, [organizationValues.name, organizationValues.description], 'Invalid organization values');
    const invalidProject = await invalidSubmission(browser, '/new-project', { ...projectValues, date: 'not-a-date' }, 'project');
    assertEscaped(invalidProject, [projectValues.title, projectValues.description, projectValues.location, organizationValues.name], 'Invalid project values');
    const invalidEdit = await invalidSubmission(browser, `/edit-organization/${organization.id}`, { ...organizationValues, logoFilename: '../missing.png' }, 'organization');
    assertEscaped(invalidEdit, [organizationValues.name, organizationValues.description], 'Invalid organization edit values');
    const oversizedCategory = `${categoryName}${'x'.repeat(101)}`;
    for (const resource of ['/new-category', `/edit-category/${category.id}`]) assertEscaped(await invalidSubmission(browser, resource, { name: oversizedCategory }, 'category'), [oversizedCategory], 'Invalid category values');
    const sqlValues = { name: `W04 ${token}'); DROP TABLE category; --` };
    await successfulMutation(browser, '/new-category', sqlValues, 'category', sqlValues);
  });

  await runStage('Flash lifecycle, static requests, browser isolation, and destination-scoped form state', async () => {
    const baselineHtml = await invalidSubmission(browser, '/new-organization', { ...organizationBase, name: 'ab' }, 'organization');
    const baseline = flashMessages(baselineHtml, 'error').join(' ').replace(/^(?:error|validation errors?)[:.!]?\s*/i, '').trim();
    const before = await snapshot();
    const owner = new Browser();
    const observer = new Browser();
    const first = await owner.post('/new-organization', { ...organizationBase, name: 'ab' });
    redirectDestination(first, ['/new-organization']);
    await owner.get('/css/main.css');
    await owner.request('/css/main.css', { method: 'HEAD' });
    await owner.get('/images/placeholder-logo.png', { binary: true });
    const untouched = await observer.get('/new-organization');
    assert.equal(flashMessages(untouched.html, 'error').length, 0, 'Another browser cannot see pending error messages');
    const second = await owner.post('/new-organization', { ...organizationBase, name: 'ab' });
    redirectDestination(second, ['/new-organization']);
    const rendered = await owner.get('/new-organization');
    const accumulated = flashMessages(rendered.html, 'error').join(' ');
    assert.ok(baseline && accumulated.split(baseline).length - 1 >= 2, 'Assets, HEAD requests, and another POST redirect do not consume pending flash messages');
    assert.equal(flashMessages((await owner.get('/new-organization')).html, 'error').length, 0, 'Accumulated messages disappear after the actual render');
    const left = new Browser();
    const right = new Browser();
    const leftValues = { ...organizationBase, name: `Left browser <b>${token}</b>`, contactEmail: 'left-invalid' };
    const rightValues = { ...organizationBase, name: `Right browser <b>${token}</b>`, contactEmail: 'right-invalid' };
    await left.post('/new-organization', leftValues);
    await right.post('/new-organization', rightValues);
    assert.ok([...left.cookies.values()].some((cookie) => ![...right.cookies.values()].some((other) => cookie.value === other.value)), 'Independent browsers receive distinct session identities');
    const leftHtml = await renderFlashOnce(left, '/new-organization', 'error', validationMessage);
    const rightHtml = await renderFlashOnce(right, '/new-organization', 'error', validationMessage);
    assert.ok(leftHtml.includes(ejs.escapeXML(leftValues.name)) && !leftHtml.includes(ejs.escapeXML(rightValues.name)), 'Left browser retains only its own escaped values');
    assert.ok(rightHtml.includes(ejs.escapeXML(rightValues.name)) && !rightHtml.includes(ejs.escapeXML(leftValues.name)), 'Right browser retains only its own escaped values');
    const scoped = new Browser();
    const createValues = { ...organizationBase, name: `Create path ${token}`, contactEmail: 'create-invalid' };
    const editValues = { ...organizationBase, name: `Edit path ${token}`, contactEmail: 'edit-invalid', logoFilename: 'brightfuture-logo.png' };
    await scoped.post('/new-organization', createValues);
    await scoped.post(`/edit-organization/${context.organizationId}`, editValues);
    const unrelated = await scoped.get('/new-category');
    assert.ok(!unrelated.html.includes(createValues.name) && !unrelated.html.includes(editValues.name), 'Unrelated form destinations do not display retained organization values');
    const otherEdit = await scoped.get('/edit-organization/1');
    await verifyForm(otherEdit.html, '/edit-organization/1', 'organization', { row: entityFrom(before, 'organization', 1) });
    const createHtml = (await scoped.get('/new-organization')).html;
    const editHtml = (await scoped.get(`/edit-organization/${context.organizationId}`)).html;
    assert.equal(valueFrom(controlFrom(formFrom(createHtml, '/new-organization'), 'name')), createValues.name, 'Create form data survives unrelated renders and is keyed by destination');
    assert.equal(valueFrom(controlFrom(formFrom(editHtml, `/edit-organization/${context.organizationId}`), 'name')), editValues.name, 'Edit form data is keyed by its exact destination ID');
    assert.equal(valueFrom(controlFrom(formFrom((await scoped.get('/new-organization')).html, '/new-organization'), 'name')), '', 'Create form data is consumed only by its own form render');
    await verifyForm((await scoped.get(`/edit-organization/${context.organizationId}`)).html, `/edit-organization/${context.organizationId}`, 'organization', { row: entityFrom(before, 'organization', context.organizationId) });
    assert.deepEqual(await snapshot(), before, 'Session, flash, and invalid-input tests never change database records');
  });

  await runStage('One-client assignment transactions and concurrent project-row serialization', async () => {
    const projectId = context.projectId;
    const canonical = `/assign-categories/${projectId}`;
    await assignmentMutation(browser, canonical, { categoryIds: ['1', '3'] }, projectId, [1, 3]);
    await client.query('CREATE TABLE w04_assignment_audit (operation TEXT NOT NULL, project_id INTEGER NOT NULL, category_id INTEGER NOT NULL, transaction_id BIGINT NOT NULL, backend_id INTEGER NOT NULL)');
    await client.query(`
      CREATE FUNCTION w04_audit_assignment() RETURNS trigger LANGUAGE plpgsql AS $function$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.project_id = ${projectId} THEN
            INSERT INTO w04_assignment_audit VALUES (TG_OP, OLD.project_id, OLD.category_id, txid_current(), pg_backend_pid());
          END IF;
          RETURN OLD;
        END IF;
        IF NEW.project_id = ${projectId} THEN
          INSERT INTO w04_assignment_audit VALUES (TG_OP, NEW.project_id, NEW.category_id, txid_current(), pg_backend_pid());
          PERFORM pg_sleep(0.1);
        END IF;
        RETURN NEW;
      END;
      $function$;
      CREATE TRIGGER w04_assignment_audit_trigger AFTER INSERT OR DELETE ON project_category FOR EACH ROW EXECUTE FUNCTION w04_audit_assignment()
    `);
    let lockHeld = false;
    const pending = [];
    try {
      await assignmentMutation(browser, canonical, { categoryIds: ['2', '4'] }, projectId, [2, 4]);
      const audit = (await client.query('SELECT operation, transaction_id::text, backend_id FROM w04_assignment_audit')).rows;
      assert.ok(audit.some((row) => row.operation === 'DELETE') && audit.some((row) => row.operation === 'INSERT'), 'Transaction audit observes both removal and insertion');
      assert.equal(new Set(audit.map((row) => row.transaction_id)).size, 1, 'All replacement writes share one PostgreSQL transaction');
      assert.equal(new Set(audit.map((row) => row.backend_id)).size, 1, 'All replacement writes use one checked-out PostgreSQL client');
      await client.query('TRUNCATE w04_assignment_audit');
      const before = await snapshot();
      await client.query('BEGIN');
      lockHeld = true;
      await client.query('SELECT project_id FROM project WHERE project_id = $1 FOR UPDATE', [projectId]);
      const startPending = (currentBrowser, categoryIds) => {
        const tracked = { settled: false };
        tracked.promise = currentBrowser.post(canonical, { categoryIds }).finally(() => { tracked.settled = true; });
        tracked.promise.catch(() => {});
        pending.push(tracked);
        return tracked;
      };
      const waitForLocks = async (expected) => {
        const deadline = Date.now() + 7000;
        while (Date.now() < deadline) {
          interrupted.signal.throwIfAborted();
          await client.query('SELECT pg_stat_clear_snapshot()');
          const result = await client.query("SELECT COUNT(*)::integer AS count FROM pg_stat_activity WHERE application_name = $1 AND state = 'active' AND wait_event_type = 'Lock' AND query ~* 'FOR[[:space:]]+UPDATE'", [applicationName]);
          if (result.rows[0].count >= expected) return;
          assert.ok(!pending.some((tracked) => tracked.settled), 'Assignments must wait for the held project row lock before completing');
          await delay(30);
        }
        assert.fail('Category replacement did not wait on SELECT FOR UPDATE of the target project');
      };
      const left = new Browser();
      const right = new Browser();
      const first = startPending(left, ['1']);
      await waitForLocks(1);
      const second = startPending(right, ['2', '3']);
      await waitForLocks(2);
      assert.deepEqual(await snapshot(), before, 'Blocked replacements cannot delete or insert assignments before obtaining the project row lock');
      const unrelatedBrowser = new Browser();
      await assignmentMutation(unrelatedBrowser, '/assign-categories/2', { categoryIds: ['4'] }, 2, [4], { timeout: 4000 });
      const withUnrelated = await snapshot();
      assert.deepEqual(assignmentsFrom(withUnrelated, projectId), assignmentsFrom(before, projectId), 'An unrelated project can update while the target remains locked');
      await client.query('COMMIT');
      lockHeld = false;
      const responses = await Promise.all([first.promise, second.promise]);
      const after = await snapshot();
      assertOnlyAssignmentsChanged(withUnrelated, after, projectId);
      const finalSet = assignmentsFrom(after, projectId);
      assert.ok(JSON.stringify(finalSet) === JSON.stringify([1]) || JSON.stringify(finalSet) === JSON.stringify([2, 3]), 'Concurrent replacements leave one complete requested set, never a union or partial set');
      const concurrentAudit = (await client.query('SELECT operation, transaction_id::text, backend_id FROM w04_assignment_audit')).rows;
      const groups = new Map();
      for (const row of concurrentAudit) groups.set(row.transaction_id, [...(groups.get(row.transaction_id) || []), row]);
      assert.equal(groups.size, 2, 'Concurrent replacements use two independent atomic transactions');
      for (const rows of groups.values()) {
        assert.equal(new Set(rows.map((row) => row.backend_id)).size, 1, 'Each concurrent replacement stays on its own single client');
        assert.ok(rows.some((row) => row.operation === 'DELETE') && rows.some((row) => row.operation === 'INSERT'), 'Each concurrent transaction performs its complete replacement');
      }
      for (const [index, currentBrowser] of [left, right].entries()) await renderFlashOnce(currentBrowser, redirectDestination(responses[index], [`/project/${projectId}`]), 'success', successMessage);
      await verifyForm((await browser.get(canonical)).html, canonical, 'assignment', { selectedCategories: finalSet });
      await assignmentMutation(browser, '/assign-categories/2', { categoryIds: assignmentsFrom(before, 2).map(String) }, 2, assignmentsFrom(before, 2));
    } finally {
      if (lockHeld) await client.query('ROLLBACK');
      await Promise.allSettled(pending.map((tracked) => tracked.promise));
      await client.query('DROP TRIGGER IF EXISTS w04_assignment_audit_trigger ON project_category');
      await client.query('DROP FUNCTION IF EXISTS w04_audit_assignment()');
      await client.query('DROP TABLE IF EXISTS w04_assignment_audit');
    }
  });

  await runStage('Rollback on mid-replacement failure, hidden database errors, and recovery', async () => {
    const projectId = context.projectId;
    await assignmentMutation(browser, `/assign-categories/${projectId}`, { categoryIds: ['1', '3'] }, projectId, [1, 3]);
    const marker = 'W04_PRIVATE_ASSIGNMENT_FAILURE';
    await client.query(`
      CREATE FUNCTION w04_fail_assignment() RETURNS trigger LANGUAGE plpgsql AS $function$
      BEGIN
        IF NEW.project_id = ${projectId} AND NEW.category_id = 4 THEN
          RAISE EXCEPTION '${marker}' USING DETAIL = '${schema}';
        END IF;
        RETURN NEW;
      END;
      $function$;
      CREATE TRIGGER w04_assignment_failure BEFORE INSERT ON project_category FOR EACH ROW EXECUTE FUNCTION w04_fail_assignment()
    `);
    const before = await snapshot();
    try {
      for (const resource of [`/assign-categories/${projectId}`, `/project/${projectId}/assign-categories`]) {
        const response = await browser.post(resource, { categoryIds: ['2', '4'] }, { status: 500 });
        assertServerError(response.html, [marker]);
        assert.deepEqual(await snapshot(), before, 'Failed assignment restores the old set and rolls back any successful intermediate inserts');
      }
    } finally {
      await client.query('DROP TRIGGER IF EXISTS w04_assignment_failure ON project_category');
      await client.query('DROP FUNCTION IF EXISTS w04_fail_assignment()');
    }
    await assignmentMutation(browser, `/assign-categories/${projectId}`, { categoryIds: ['2', '4'] }, projectId, [2, 4]);
    for (const [table, field, payload, id] of [['organization', 'name', { ...organizationBase, logoFilename: 'brightfuture-logo.png' }, context.organizationId], ['project', 'title', projectBase, context.projectId], ['category', 'name', categoryBase, context.categoryId]]) {
      const privateMarker = `W04_PRIVATE_${table.toUpperCase()}_FAILURE`;
      await client.query(`
        CREATE FUNCTION w04_fail_${table}() RETURNS trigger LANGUAGE plpgsql AS $function$
        BEGIN
          IF NEW.${field} = '${privateMarker}' THEN
            RAISE EXCEPTION '${privateMarker}' USING DETAIL = '${schema}';
          END IF;
          RETURN NEW;
        END;
        $function$;
        CREATE TRIGGER w04_${table}_failure BEFORE INSERT OR UPDATE ON ${quoteIdentifier(table)} FOR EACH ROW EXECUTE FUNCTION w04_fail_${table}()
      `);
      const state = await snapshot();
      try {
        for (const resource of [`/new-${table}`, `/edit-${table}/${id}`]) {
          const response = await browser.post(resource, { ...payload, [field]: privateMarker }, { status: 500 });
          assertServerError(response.html, [privateMarker]);
          assert.deepEqual(await snapshot(), state, `${resource}: unexpected database failure changes no application records`);
        }
      } finally {
        await client.query(`DROP TRIGGER IF EXISTS w04_${table}_failure ON ${quoteIdentifier(table)}`);
        await client.query(`DROP FUNCTION IF EXISTS w04_fail_${table}()`);
      }
      await browser.get(`/edit-${table}/${id}`);
    }
    const failure = await browser.get('/test-error', { status: 500 });
    assertServerError(failure.html);
    const beforeRename = await snapshot();
    await client.query('ALTER TABLE category RENAME TO w04_unavailable_category');
    try {
      assertServerError((await browser.get('/categories', { status: 500 })).html, ['w04_unavailable_category']);
      assertServerError((await browser.get(`/assign-categories/${projectId}`, { status: 500 })).html, ['w04_unavailable_category']);
    } finally {
      await client.query('ALTER TABLE w04_unavailable_category RENAME TO category');
    }
    await browser.get('/categories');
    await browser.get(`/assign-categories/${projectId}`);
    assert.deepEqual(await snapshot(), beforeRename, 'Application recovers after database availability is restored without altering records');
    await client.query('ALTER TABLE organization RENAME TO w04_unavailable_organization');
    try {
      for (const resource of ['/new-project', `/edit-project/${projectId}`]) {
        const response = await browser.post(resource, projectBase, { status: 500 });
        assertServerError(response.html, ['w04_unavailable_organization']);
        assert.ok(!/class="[^"]*\balert\b[^"]*\berror\b/.test(response.html), 'Database lookup failures are not misreported as invalid user input');
      }
    } finally {
      await client.query('ALTER TABLE w04_unavailable_organization RENAME TO organization');
    }
    await browser.get('/new-project');
    assert.deepEqual(await snapshot(), beforeRename, 'Failed organization lookups leave application records unchanged');
  });
  console.log(`All W04 checks passed, including ${assertionsOfInvalidSubmissions} rejected submissions, isolated sessions, escaped views, and atomic concurrent updates.`);
};

try {
  await runVerification();
} catch (error) {
  process.exitCode = 1;
  console.error(`W04 verification failed during ${stage}: ${safeMessage(error)}`);
  const codes = [...new Set([...serverErrors.matchAll(/\b(?:code:\s*['"]|Error\s*\[)([A-Z0-9_]{2,40})/g)].map((match) => match[1]))];
  if (codes.length) console.error(`Application error codes: ${codes.join(', ')}`);
} finally {
  try {
    await stopServer();
  } catch (error) {
    process.exitCode = 1;
    console.error(`W04 process cleanup failed: ${safeMessage(error)}`);
  }
  if (client && connected && schemaAttempted) {
    try {
      await client.query('ROLLBACK');
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      console.log('Removed disposable W04 verification schema.');
    } catch (error) {
      process.exitCode = 1;
      console.error(`W04 schema cleanup failed: ${safeMessage(error)}`);
    }
  }
  if (client) {
    try {
      await client.end();
    } catch (error) {
      process.exitCode = 1;
      console.error(`W04 database client cleanup failed: ${safeMessage(error)}`);
    }
  }
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', interrupt);
}
