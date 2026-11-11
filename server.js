import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { navigation } from './src/data/site.js';
import db, { testConnection } from './src/models/db.js';
import { getAllOrganizations } from './src/models/organizations.js';
import { getAllProjects } from './src/models/projects.js';
import { getAllCategories } from './src/models/categories.js';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const nodeEnvironment = process.env.NODE_ENV?.toLowerCase() || 'production';
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const app = express();

app.use(express.static(path.join(projectDirectory, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(projectDirectory, 'src/views'));
app.locals.navigation = navigation;

app.get('/', async (req, res, next) => {
  try {
    const [organizations, projects, categories] = await Promise.all([
      getAllOrganizations(), getAllProjects(), getAllCategories(),
    ]);
    const title = 'Home';
    res.render('home', { title, currentPath: '/', organizations, projects, categories });
  } catch (error) {
    next(error);
  }
});

app.get('/organizations', async (req, res, next) => {
  try {
    const organizations = await getAllOrganizations();
    const title = 'Our Partner Organizations';
    res.render('organizations', { title, currentPath: '/organizations', organizations });
  } catch (error) {
    next(error);
  }
});

app.get('/projects', async (req, res, next) => {
  try {
    const projects = await getAllProjects();
    const title = 'Service Projects';
    res.render('projects', { title, currentPath: '/projects', projects });
  } catch (error) {
    next(error);
  }
});

app.get('/categories', async (req, res, next) => {
  try {
    const categories = await getAllCategories();
    const title = 'Service Project Categories';
    res.render('categories', { title, currentPath: '/categories', categories });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found', currentPath: req.path,
    message: 'This page could not be found. Use the navigation to explore the service network.',
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('Request failed:', { path: req.path, code: error.code || 'SERVER_ERROR' });
  res.status(500).render('error', {
    title: 'Service Temporarily Unavailable', currentPath: req.path,
    message: 'We could not load this page. Please try again shortly.',
  });
});

await testConnection();
const server = app.listen(port, host);
await once(server, 'listening');
console.log(`Server is running at http://${host}:${server.address().port}`);
console.log(`Environment: ${nodeEnvironment}`);

const shutdown = async () => {
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
