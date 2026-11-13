import express from 'express';
import { showHomePage } from './controllers/index.js';
import { showOrganizationsPage, showOrganizationDetailsPage } from './controllers/organizations.js';
import { showProjectsPage, showProjectDetailsPage } from './controllers/projects.js';
import { showCategoriesPage, showCategoryDetailsPage } from './controllers/categories.js';
import { testErrorPage } from './controllers/errors.js';
import { asyncHandler } from './utilities/async-handler.js';

const router = express.Router();

router.get('/', asyncHandler(showHomePage));
router.get('/organizations', asyncHandler(showOrganizationsPage));
router.get('/organization/:id', asyncHandler(showOrganizationDetailsPage));
router.get('/projects', asyncHandler(showProjectsPage));
router.get('/project/:id', asyncHandler(showProjectDetailsPage));
router.get('/categories', asyncHandler(showCategoriesPage));
router.get('/category/:id', asyncHandler(showCategoryDetailsPage));
router.get('/test-error', testErrorPage);

export default router;
