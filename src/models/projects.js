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

const createProject = async (title, description, location, date, organizationId) => {
  const query = `
    INSERT INTO project (title, description, location, date, organization_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING project_id;
  `;
  const result = await db.query(query, [title, description, location, date, organizationId]);
  if (result.rowCount !== 1) throw new Error('Failed to create service project');
  return result.rows[0].project_id;
};

const updateProject = async (projectId, title, description, location, date, organizationId) => {
  const query = `
    UPDATE project
    SET title = $1, description = $2, location = $3, date = $4, organization_id = $5
    WHERE project_id = $6
    RETURNING project_id;
  `;
  const result = await db.query(query, [title, description, location, date, organizationId, projectId]);
  if (result.rowCount !== 1) {
    const error = new Error('Service project not found');
    error.status = 404;
    throw error;
  }
  return result.rows[0].project_id;
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
  createProject,
  updateProject,
  getProjectsByOrganizationId,
  getProjectsByCategoryId,
};
