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

export { getAllCategories, getCategoryDetails, getCategoriesByProjectId };
