import express from 'express';
import { showHomePage } from './controllers/index.js';
import {
  showOrganizationsPage,
  showOrganizationDetailsPage,
  showNewOrganizationForm,
  processNewOrganizationForm,
  showEditOrganizationForm,
  processEditOrganizationForm,
  organizationValidation,
  organizationLogoValidation,
} from './controllers/organizations.js';
import {
  showProjectsPage,
  showProjectDetailsPage,
  showNewProjectForm,
  processNewProjectForm,
  showEditProjectForm,
  processEditProjectForm,
  projectValidation,
} from './controllers/projects.js';
import {
  showCategoriesPage,
  showCategoryDetailsPage,
  showNewCategoryForm,
  processNewCategoryForm,
  showEditCategoryForm,
  processEditCategoryForm,
  showAssignCategoriesForm,
  processAssignCategoriesForm,
  categoryValidation,
  categoryAssignmentValidation,
} from './controllers/categories.js';
import { testErrorPage } from './controllers/errors.js';
import { asyncHandler } from './utilities/async-handler.js';

const router = express.Router();

router.get('/', asyncHandler(showHomePage));
router.get('/organizations', asyncHandler(showOrganizationsPage));
router.get('/organization/:id', asyncHandler(showOrganizationDetailsPage));
router.get('/new-organization', asyncHandler(showNewOrganizationForm));
router.post('/new-organization', organizationValidation, asyncHandler(processNewOrganizationForm));
router.get('/edit-organization/:id', asyncHandler(showEditOrganizationForm));
router.post('/edit-organization/:id', organizationValidation, organizationLogoValidation, asyncHandler(processEditOrganizationForm));
router.get('/projects', asyncHandler(showProjectsPage));
router.get('/project/:id', asyncHandler(showProjectDetailsPage));
router.get('/new-project', asyncHandler(showNewProjectForm));
router.post('/new-project', projectValidation, asyncHandler(processNewProjectForm));
router.get('/edit-project/:id', asyncHandler(showEditProjectForm));
router.post('/edit-project/:id', projectValidation, asyncHandler(processEditProjectForm));
router.get('/categories', asyncHandler(showCategoriesPage));
router.get('/category/:id', asyncHandler(showCategoryDetailsPage));
router.get('/new-category', asyncHandler(showNewCategoryForm));
router.post('/new-category', categoryValidation, asyncHandler(processNewCategoryForm));
router.get('/edit-category/:id', asyncHandler(showEditCategoryForm));
router.post('/edit-category/:id', categoryValidation, asyncHandler(processEditCategoryForm));
router.get('/assign-categories/:projectId', asyncHandler(showAssignCategoriesForm));
router.post('/assign-categories/:projectId', categoryAssignmentValidation, asyncHandler(processAssignCategoriesForm));
router.get('/project/:projectId/assign-categories', asyncHandler(showAssignCategoriesForm));
router.post('/project/:projectId/assign-categories', categoryAssignmentValidation, asyncHandler(processAssignCategoriesForm));
router.get('/test-error', testErrorPage);

export default router;
