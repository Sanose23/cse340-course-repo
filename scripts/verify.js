import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const verifySite = async () => {
  const baseUrl = new URL(process.argv.slice(2).find((argument) => argument !== '--') || `http://127.0.0.1:${process.env.PORT || 3000}`);
  const pageSpecs = [
    { path: '/', title: 'Home', content: ['Welcome to the', 'CSE 340', 'Service Network!'] },
    { path: '/organizations', title: 'Our Partner Organizations', content: ['BrightFuture Builders', 'GreenHarvest Growers', 'UnityServe Volunteers', 'info@brightfuturebuilders.org', 'contact@greenharvest.org', 'hello@unityserve.org', 'A nonprofit focused on improving community infrastructure', 'An urban farming collective', 'A volunteer coordination group'] },
    { path: '/projects', title: 'Upcoming Service Projects', content: ['Park Cleanup', 'Community Garden Planting', 'Community Tutoring'] },
    { path: '/categories', title: 'Service Project Categories', content: ['Environmental', 'Educational', 'Community Service', 'Health and Wellness'] },
  ];
  const renderedPages = new Map();
  const imagePaths = new Set();
  const request = async (resource, status, contentType) => {
    const response = await fetch(new URL(resource, baseUrl), { signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, status, `${resource}: HTTP status`);
    if (contentType) assert.match(response.headers.get('content-type') || '', contentType, `${resource}: content type`);
    return response;
  };

  for (const spec of pageSpecs) {
    const response = await request(spec.path, 200, /text\/html/);
    const html = await response.text();
    renderedPages.set(spec.path, html);
    assert.ok(html.includes(`<title>${spec.title} | CSE 340 Service Network</title>`), `${spec.path}: EJS page title`);
    assert.match(html, /<h1[^>]*>/, `${spec.path}: page heading`);
    assert.ok(html.includes('class="site-header"') && html.includes('class="site-footer"'), `${spec.path}: shared partials`);
    assert.ok(html.includes(`${new Date().getFullYear()} CSE 340 Service Network.`), `${spec.path}: copyright`);
    assert.ok(html.includes('href="/css/main.css"'), `${spec.path}: stylesheet`);
    const mainNavigation = html.match(/<nav aria-label="Main navigation">([\s\S]*?)<\/nav>/)?.[1] || '';
    for (const target of pageSpecs) assert.ok(mainNavigation.includes(`href="${target.path}"`), `${spec.path}: link to ${target.path}`);
    assert.equal((mainNavigation.match(/aria-current="page"/g) || []).length, 1, `${spec.path}: one active navigation link`);
    for (const expected of spec.content) assert.ok(html.includes(expected), `${spec.path}: ${expected}`);
    if (spec.path === '/projects') {
      assert.equal((html.match(/class="project-card"/g) || []).length, 5, 'Next five seeded projects render');
      assert.equal((html.match(/<time datetime=/g) || []).length, 5, 'Each project renders its date');
      assert.equal((html.match(/href="\/project\/\d+"/g) || []).length, 10, 'Each project has detail links');
      assert.ok(html.includes('href="/organization/1"'), 'Organization detail links render');
    }
    assert.ok(!html.includes('<%'), `${spec.path}: all EJS rendered`);
    for (const image of html.matchAll(/<img[^>]+src="([^"<>]+)"/g)) imagePaths.add(image[1]);
    console.log(`PASS ${spec.path}: content, title, navigation, shared partials`);
  }

  for (const [source, html] of renderedPages) {
    for (const link of html.matchAll(/href="([^"<>]+)"/g)) {
      if (!link[1].startsWith('/') && !link[1].startsWith('#')) continue;
      const url = new URL(link[1], new URL(source, baseUrl));
      if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/images/')) continue;
      const detailRoute = /^\/(organization|project|category)\/\d+$/.test(url.pathname);
      assert.ok(renderedPages.has(url.pathname) || detailRoute, `${source}: valid internal route ${url.pathname}`);
      if (url.hash && renderedPages.has(url.pathname)) assert.ok(renderedPages.get(url.pathname).includes(`id="${url.hash.slice(1)}"`), `${source}: valid anchor ${url.hash}`);
    }
  }
  const css = await request('/css/main.css', 200, /text\/css/);
  assert.ok((await css.text()).length > 100, 'Stylesheet has content');
  for (const imagePath of imagePaths) {
    const image = await request(imagePath, 200, /image\/png/);
    assert.ok((await image.arrayBuffer()).byteLength > 0, `${imagePath}: image bytes`);
  }
  await request('/images/favicon.svg', 200, /image\/svg\+xml/);
  console.log(`PASS stylesheet, ${imagePaths.size} PNG images, and favicon`);
  for (const resource of ['/.env', '/server.js', '/src/views/home.ejs', '/missing-page']) await request(resource, 404);
  console.log('PASS missing route and private/source file exclusion');

  const unsafeTitle = '<script>alert("title")</script>';
  const header = await ejs.renderFile(path.join(projectDirectory, 'src/views/partials/header.ejs'), {
    title: unsafeTitle,
    currentPath: '/',
    navigation: pageSpecs.map((spec) => ({ label: spec.title, href: spec.path })),
    NODE_ENV: 'test',
  });
  assert.ok(!header.includes(unsafeTitle) && header.includes('&lt;script&gt;'), 'Header escapes title data');
  console.log(`All checks passed for ${baseUrl.origin}; EJS title escaping verified`);
};

try {
  await verifySite();
} catch (error) {
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
}
