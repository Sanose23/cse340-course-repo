import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Set DB_URL or DATABASE_URL before starting the application.');
}

const isRenderInternal = /^dpg-[a-z0-9-]+$/.test(new URL(connectionString).hostname);
const db = new Pool({
  connectionString,
  ssl: isRenderInternal ? { rejectUnauthorized: false } : true,
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
});

if (process.env.NODE_ENV === 'development' && process.env.ENABLE_SQL_LOGGING === 'true') {
  const query = db.query.bind(db);
  db.query = async (text, params) => {
    const start = Date.now();
    const result = await query(text, params);
    console.log('Executed query:', {
      text: text.replace(/\s+/g, ' ').trim(),
      duration: `${Date.now() - start}ms`,
      rows: result.rowCount,
    });
    return result;
  };
}

db.on('error', (error) => console.error('Idle database connection failed:', error.code));

const testConnection = async () => {
  const result = await db.query('SELECT NOW() AS current_time');
  console.log('Database connection successful:', result.rows[0].current_time);
  return true;
};

export { db as default, testConnection };
