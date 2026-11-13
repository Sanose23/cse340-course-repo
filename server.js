import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { navigation } from './src/data/site.js';
import db, { testConnection } from './src/models/db.js';
import router from './src/routes.js';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const nodeEnvironment = process.env.NODE_ENV?.toLowerCase() || 'production';
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const app = express();

app.use(express.static(path.join(projectDirectory, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(projectDirectory, 'src/views'));
app.locals.navigation = navigation;

app.use((req, res, next) => {
  if (nodeEnvironment === 'development') console.log(`${req.method} ${req.url}`);
  next();
});

app.use((req, res, next) => {
  res.locals.NODE_ENV = nodeEnvironment;
  next();
});

app.use(router);

app.use((req, res, next) => {
  const error = new Error('Page Not Found');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const invalidIdentifier = error.code === '22P02';
  const status = error.status === 404 || invalidIdentifier ? 404 : 500;
  console.error('Request failed:', {
    path: req.path,
    status,
    code: error.code || 'SERVER_ERROR',
    message: error.message,
  });
  res.status(status).render(`errors/${status}`, {
    title: status === 404 ? 'Page Not Found' : 'Service Temporarily Unavailable',
    currentPath: req.path,
    error: error.message,
    stack: error.stack,
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
