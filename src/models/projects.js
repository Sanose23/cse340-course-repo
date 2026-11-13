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

const getUpcomingProjects = async (numberOfProjects) => {
  const query = `
    SELECT p.project_id, p.organization_id, p.title, p.description, p.location,
           TO_CHAR(p.date, 'YYYY-MM-DD') AS date, o.name AS organization_name
    FROM project AS p
    JOIN organization AS o ON o.organization_id = p.organization_id
    WHERE p.date >= CURRENT_DATE
    ORDER BY p.date, p.project_id
    LIMIT $1;
  `;
  const result = await db.query(query, [numberOfProjects]);
  return result.rows;
};

const getProjectDetails = async (projectId) => {
  const query = `
    SELECT p.project_id, p.organization_id, p.title, p.description, p.location,
           TO_CHAR(p.date, 'YYYY-MM-DD') AS date, o.name AS organization_name
    FROM project AS p
    JOIN organization AS o ON o.organization_id = p.organization_id
    WHERE p.project_id = $1;
  `;
  const result = await db.query(query, [projectId]);
  return result.rows[0] || null;
};

const getProjectsByOrganizationId = async (organizationId) => {
  const query = `
    SELECT project_id, organization_id, title, description, location,
           TO_CHAR(date, 'YYYY-MM-DD') AS date
    FROM project
    WHERE organization_id = $1
    ORDER BY date, project_id;
  `;
  const result = await db.query(query, [organizationId]);
  return result.rows;
};

const getProjectsByCategoryId = async (categoryId) => {
  const query = `
    SELECT p.project_id, p.organization_id, p.title, p.description, p.location,
           TO_CHAR(p.date, 'YYYY-MM-DD') AS date, o.name AS organization_name
    FROM project AS p
    JOIN organization AS o ON o.organization_id = p.organization_id
    JOIN project_category AS pc ON pc.project_id = p.project_id
    WHERE pc.category_id = $1
    ORDER BY p.date, p.project_id;
  `;
  const result = await db.query(query, [categoryId]);
  return result.rows;
};

export {
  getAllProjects,
  getUpcomingProjects,
  getProjectDetails,
  getProjectsByOrganizationId,
  getProjectsByCategoryId,
};
