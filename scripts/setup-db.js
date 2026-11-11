import { readFile } from 'node:fs/promises';
import db from '../src/models/db.js';

try {
  const existing = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('organization', 'project', 'category', 'project_category');
  `);
  if (existing.rows.length) {
    throw new Error('W02 tables already exist. Setup is only for an empty application schema.');
  }
  await db.query(await readFile(new URL('../src/setup.sql', import.meta.url), 'utf8'));
  console.log('W02 setup complete: 3 organizations, 15 projects, 4 categories, 24 category links.');
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
