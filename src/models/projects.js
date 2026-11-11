import db from './db.js';

const getAllProjects = async () => {
  const query = `
    SELECT p.project_id, p.organization_id, p.title, p.description, p.location,
           TO_CHAR(p.date, 'YYYY-MM-DD') AS date, o.name AS organization_name
    FROM project AS p
    JOIN organization AS o ON o.organization_id = p.organization_id
    ORDER BY p.date, p.project_id;
  `;
  const result = await db.query(query);
  return result.rows;
};

export { getAllProjects };
