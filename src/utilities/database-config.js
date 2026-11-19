const getDatabaseSsl = (connectionString) => {
  const hostname = new URL(connectionString).hostname;
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return false;
  return /^dpg-[a-z0-9-]+$/.test(hostname) ? { rejectUnauthorized: false } : true;
};

export { getDatabaseSsl };
