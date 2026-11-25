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
import {
  showUserRegistrationForm,
  processUserRegistrationForm,
  showLoginForm,
  processLoginForm,
  processLogout,
  requireLogin,
  requireRole,
  showDashboard,
  showUsersPage,
  registrationValidation,
  loginValidation,
} from './controllers/users.js';
import { testErrorPage } from './controllers/errors.js';
import { asyncHandler } from './utilities/async-handler.js';

const router = express.Router();

router.get('/', asyncHandler(showHomePage));
router.get('/register', showUserRegistrationForm);
router.post('/register', registrationValidation, asyncHandler(processUserRegistrationForm));
router.get('/login', showLoginForm);
router.post('/login', loginValidation, asyncHandler(processLoginForm));
router.get('/logout', asyncHandler(processLogout));
router.post('/logout', asyncHandler(processLogout));
router.get('/dashboard', requireLogin, showDashboard);
router.get('/users', requireRole('admin'), asyncHandler(showUsersPage));
router.get('/organizations', asyncHandler(showOrganizationsPage));
router.get('/organization/:id', asyncHandler(showOrganizationDetailsPage));
router.get('/new-organization', requireRole('admin'), asyncHandler(showNewOrganizationForm));
router.post('/new-organization', requireRole('admin'), organizationValidation, asyncHandler(processNewOrganizationForm));
router.get('/edit-organization/:id', requireRole('admin'), asyncHandler(showEditOrganizationForm));
router.post('/edit-organization/:id', requireRole('admin'), organizationValidation, organizationLogoValidation, asyncHandler(processEditOrganizationForm));
router.get('/projects', asyncHandler(showProjectsPage));
router.get('/project/:id', asyncHandler(showProjectDetailsPage));
router.get('/new-project', requireRole('admin'), asyncHandler(showNewProjectForm));
router.post('/new-project', requireRole('admin'), projectValidation, asyncHandler(processNewProjectForm));
router.get('/edit-project/:id', requireRole('admin'), asyncHandler(showEditProjectForm));
router.post('/edit-project/:id', requireRole('admin'), projectValidation, asyncHandler(processEditProjectForm));
router.get('/categories', asyncHandler(showCategoriesPage));
router.get('/category/:id', asyncHandler(showCategoryDetailsPage));
router.get('/new-category', requireRole('admin'), asyncHandler(showNewCategoryForm));
router.post('/new-category', requireRole('admin'), categoryValidation, asyncHandler(processNewCategoryForm));
router.get('/edit-category/:id', requireRole('admin'), asyncHandler(showEditCategoryForm));
router.post('/edit-category/:id', requireRole('admin'), categoryValidation, asyncHandler(processEditCategoryForm));
router.get('/assign-categories/:projectId', requireRole('admin'), asyncHandler(showAssignCategoriesForm));
router.post('/assign-categories/:projectId', requireRole('admin'), categoryAssignmentValidation, asyncHandler(processAssignCategoriesForm));
router.get('/project/:projectId/assign-categories', requireRole('admin'), asyncHandler(showAssignCategoriesForm));
router.post('/project/:projectId/assign-categories', requireRole('admin'), categoryAssignmentValidation, asyncHandler(processAssignCategoriesForm));
router.get('/test-error', testErrorPage);

export default router;
