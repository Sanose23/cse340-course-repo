import { body } from 'express-validator';
import { getUpcomingProjects, getProjectDetails, createProject, updateProject } from '../models/projects.js';
import { getCategoriesByProjectId } from '../models/categories.js';
import { getAllOrganizations, getOrganizationDetails } from '../models/organizations.js';
import {
  requireRecordId,
  requireRecord,
  getFormData,
  rememberFormData,
  redirectWithSession,
  redirectValidationErrors,
} from '../utilities/forms.js';

const NUMBER_OF_UPCOMING_PROJECTS = 5;
const projectFields = ['title', 'description', 'location', 'date', 'organizationId'];

const projectValidation = [
  body('title')
    .custom((value) => typeof value === 'string').withMessage('Project title is required').bail()
    .trim().notEmpty().withMessage('Project title is required').bail()
    .isLength({ min: 3, max: 200 }).withMessage('Project title must be between 3 and 200 characters'),
  body('description')
    .custom((value) => typeof value === 'string').withMessage('Project description is required').bail()
    .trim().notEmpty().withMessage('Project description is required').bail()
    .isLength({ max: 1000 }).withMessage('Project description cannot exceed 1000 characters'),
  body('location')
    .custom((value) => typeof value === 'string').withMessage('Project location is required').bail()
    .trim().notEmpty().withMessage('Project location is required').bail()
    .isLength({ max: 200 }).withMessage('Project location cannot exceed 200 characters'),
  body('date')
    .custom((value) => typeof value === 'string').withMessage('Project date is required').bail()
    .trim().notEmpty().withMessage('Project date is required').bail()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Project date must use a valid YYYY-MM-DD format').bail()
    .isISO8601({ strict: true, strictSeparator: true }).withMessage('Project date must be a valid calendar date'),
  body('organizationId')
    .custom((value) => typeof value === 'string').withMessage('Organization is required').bail()
    .trim().notEmpty().withMessage('Organization is required').bail()
    .matches(/^\d+$/).withMessage('Organization must be a valid positive integer').bail()
    .custom((value) => {
      const organizationId = Number(value);
      if (!Number.isInteger(organizationId) || organizationId < 1 || organizationId > 2147483647) {
        throw new Error('Organization must be a valid positive integer');
      }
      return true;
    }),
];

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

const showNewProjectForm = async (req, res) => {
  const organizations = await getAllOrganizations();
  const formData = getFormData(req);
  const title = 'Add New Service Project';
  res.render('new-project', { title, currentPath: '/projects', organizations, formData });
};

const redirectOrganizationRace = async (req, res, error) => {
  if (error.code !== '23503') return false;
  req.flash('error', 'The selected organization is no longer available. Please choose another organization.');
  rememberFormData(req, projectFields);
  await redirectWithSession(req, res, req.path);
  return true;
};

const redirectMissingOrganization = async (req, res) => {
  if (await getOrganizationDetails(req.body.organizationId)) return false;
  req.flash('error', 'Select an existing organization');
  rememberFormData(req, projectFields);
  await redirectWithSession(req, res, req.path);
  return true;
};

const processNewProjectForm = async (req, res) => {
  if (await redirectValidationErrors(req, res, projectFields)) return;
  if (await redirectMissingOrganization(req, res)) return;
  const { title, description, location, date, organizationId } = req.body;
  try {
    const projectId = await createProject(title, description, location, date, organizationId);
    req.flash('success', 'Service project added successfully!');
    await redirectWithSession(req, res, `/project/${projectId}`);
  } catch (error) {
    if (await redirectOrganizationRace(req, res, error)) return;
    throw error;
  }
};

const showEditProjectForm = async (req, res) => {
  const projectId = requireRecordId(req.params.id, 'Service project');
  const project = requireRecord(await getProjectDetails(projectId), 'Service project');
  const organizations = await getAllOrganizations();
  const date = project.date instanceof Date
    ? project.date.toISOString().slice(0, 10)
    : String(project.date).slice(0, 10);
  const formData = getFormData(req, {
    title: project.title,
    description: project.description,
    location: project.location,
    date,
    organizationId: String(project.organization_id),
  });
  const title = 'Edit Service Project';
  res.render('edit-project', { title, currentPath: '/projects', project, organizations, formData });
};

const processEditProjectForm = async (req, res) => {
  const projectId = requireRecordId(req.params.id, 'Service project');
  requireRecord(await getProjectDetails(projectId), 'Service project');
  if (await redirectValidationErrors(req, res, projectFields)) return;
  if (await redirectMissingOrganization(req, res)) return;
  const { title, description, location, date, organizationId } = req.body;
  try {
    await updateProject(projectId, title, description, location, date, organizationId);
    req.flash('success', 'Service project updated successfully!');
    await redirectWithSession(req, res, `/project/${projectId}`);
  } catch (error) {
    if (await redirectOrganizationRace(req, res, error)) return;
    throw error;
  }
};

export {
  showProjectsPage,
  showProjectDetailsPage,
  showNewProjectForm,
  processNewProjectForm,
  showEditProjectForm,
  processEditProjectForm,
  projectValidation,
};
