import { getUpcomingProjects, getProjectDetails } from '../models/projects.js';
import { getCategoriesByProjectId } from '../models/categories.js';

const NUMBER_OF_UPCOMING_PROJECTS = 5;

const showProjectsPage = async (req, res) => {
  const projects = await getUpcomingProjects(NUMBER_OF_UPCOMING_PROJECTS);
  const title = 'Upcoming Service Projects';
  res.render('projects', { title, currentPath: '/projects', projects });
};

const showProjectDetailsPage = async (req, res) => {
  const projectId = req.params.id;
  if (!/^\d+$/.test(projectId)) {
    const error = new Error('Service project not found');
    error.status = 404;
    throw error;
  }
  const project = await getProjectDetails(projectId);
  if (!project) {
    const error = new Error('Service project not found');
    error.status = 404;
    throw error;
  }
  const categories = await getCategoriesByProjectId(projectId);
  const title = project.title;
  res.render('project', { title, currentPath: '/projects', project, categories });
};

export { showProjectsPage, showProjectDetailsPage };
