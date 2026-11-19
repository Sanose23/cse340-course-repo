import db from './db.js';

const getAllCategories = async () => {
  const query = `
    SELECT category_id, name
    FROM category
    ORDER BY category_id;
  `;
  const result = await db.query(query);
  return result.rows;
};

const getCategoryDetails = async (categoryId) => {
  const query = `
    SELECT category_id, name
    FROM category
    WHERE category_id = $1;
  `;
  const result = await db.query(query, [categoryId]);
  return result.rows[0] || null;
};

const getCategoriesByProjectId = async (projectId) => {
  const query = `
    SELECT c.category_id, c.name
    FROM category AS c
    JOIN project_category AS pc ON pc.category_id = c.category_id
    WHERE pc.project_id = $1
    ORDER BY c.name, c.category_id;
  `;
  const result = await db.query(query, [projectId]);
  return result.rows;
};

const createCategory = async (name) => {
  const result = await db.query('INSERT INTO category (name) VALUES ($1) RETURNING category_id;', [name]);
  if (result.rowCount !== 1) throw new Error('Failed to create category');
  return result.rows[0].category_id;
};

const updateCategory = async (categoryId, name) => {
  const result = await db.query('UPDATE category SET name = $1 WHERE category_id = $2 RETURNING category_id;', [name, categoryId]);
  if (result.rowCount !== 1) {
    const error = new Error('Service category not found');
    error.status = 404;
    throw error;
  }
  return result.rows[0].category_id;
};

const assignCategoryToProject = async (client, projectId, categoryId) => {
  await client.query('INSERT INTO project_category (project_id, category_id) VALUES ($1, $2);', [projectId, categoryId]);
};

const updateCategoryAssignments = async (projectId, categoryIds) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query('SELECT project_id FROM project WHERE project_id = $1 FOR UPDATE;', [projectId]);
    if (project.rowCount !== 1) {
      const error = new Error('Service project not found');
      error.status = 404;
      throw error;
    }
    await client.query('DELETE FROM project_category WHERE project_id = $1;', [projectId]);
    for (const categoryId of new Set(categoryIds)) await assignCategoryToProject(client, projectId, categoryId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export { getAllCategories, getCategoryDetails, getCategoriesByProjectId, createCategory, updateCategory, updateCategoryAssignments };
