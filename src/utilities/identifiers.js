const MAX_RESOURCE_ID = 2147483647;

const isValidId = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 && value <= MAX_RESOURCE_ID;
  return typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) && Number(value) <= MAX_RESOURCE_ID;
};

const notFound = (resource) => {
  const error = new Error(`${resource} not found`);
  error.status = 404;
  return error;
};

const requireResourceId = (value, resource) => {
  if (!isValidId(value)) throw notFound(resource);
  return Number(value);
};

export { MAX_RESOURCE_ID, isValidId, notFound, requireResourceId };
