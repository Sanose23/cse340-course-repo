import { body } from 'express-validator';
import {
  getAllCategories,
  getCategoryDetails,
  getCategoriesByProjectId,
  createCategory,
  updateCategory,
  updateCategoryAssignments,
} from '../models/categories.js';
import { getProjectsByCategoryId, getProjectDetails } from '../models/projects.js';
import { requireRecordId, requireRecord, getFormData, rememberFormData, redirectWithSession, redirectValidationErrors } from '../utilities/forms.js';

const categoryValidation = [
  body('name')
    .custom((value) => typeof value === 'string').withMessage('Category name is required').bail()
    .trim().notEmpty().withMessage('Category name is required').bail()
    .isLength({ min: 3, max: 100 }).withMessage('Category name must be between 3 and 100 characters'),
];

const categoryAssignmentValidation = [
  body('categoryIds')
    .customSanitizer((value) => value === undefined ? [] : (typeof value === 'string' ? [value] : value))
    .custom((value) => Array.isArray(value) && value.length <= 1000 && value.every((categoryId) => typeof categoryId === 'string' && /^\d+$/.test(categoryId) && Number(categoryId) >= 1 && Number(categoryId) <= 2147483647))
    .withMessage('Select valid category IDs').bail()
    .customSanitizer((value) => [...new Set(value.map((categoryId) => String(Number(categoryId))))]),
];

const showCategoriesPage = async (req, res) => {
  const categories = await getAllCategories();
  const title = 'Service Project Categories';
  res.render('categories', { title, currentPath: '/categories', categories });
};

const showCategoryDetailsPage = async (req, res) => {
  const categoryId = req.params.id;
  if (!/^\d+$/.test(categoryId)) {
    const error = new Error('Service category not found');
    error.status = 404;
    throw error;
  }
  const category = await getCategoryDetails(categoryId);
  if (!category) {
    const error = new Error('Service category not found');
    error.status = 404;
    throw error;
  }
  const projects = await getProjectsByCategoryId(categoryId);
  const title = category.name;
  res.render('category', { title, currentPath: '/categories', category, projects });
};

const showNewCategoryForm = async (req, res) => {
  const title = 'Add New Category';
  const formData = getFormData(req);
  res.render('new-category', { title, currentPath: '/categories', formData });
};

const processNewCategoryForm = async (req, res) => {
  if (await redirectValidationErrors(req, res, ['name'])) return;
  try {
    const categoryId = await createCategory(req.body.name);
    req.flash('success', 'Category added successfully!');
    await redirectWithSession(req, res, `/category/${categoryId}`);
  } catch (error) {
    if (error.code !== '23505') throw error;
    req.flash('error', 'A category with that name already exists.');
    rememberFormData(req, ['name']);
    await redirectWithSession(req, res, req.path);
  }
};

const showEditCategoryForm = async (req, res) => {
  const categoryId = requireRecordId(req.params.id, 'Service category');
  const category = requireRecord(await getCategoryDetails(categoryId), 'Service category');
  const formData = getFormData(req, { name: category.name });
  const title = 'Edit Category';
  res.render('edit-category', { title, currentPath: '/categories', category, formData });
};

const processEditCategoryForm = async (req, res) => {
  const categoryId = requireRecordId(req.params.id, 'Service category');
  requireRecord(await getCategoryDetails(categoryId), 'Service category');
  if (await redirectValidationErrors(req, res, ['name'])) return;
  try {
    await updateCategory(categoryId, req.body.name);
    req.flash('success', 'Category updated successfully!');
    await redirectWithSession(req, res, `/category/${categoryId}`);
  } catch (error) {
    if (error.code !== '23505') throw error;
    req.flash('error', 'A category with that name already exists.');
    rememberFormData(req, ['name']);
    await redirectWithSession(req, res, req.path);
  }
};

const showAssignCategoriesForm = async (req, res) => {
  const projectId = requireRecordId(req.params.projectId, 'Service project');
  const project = requireRecord(await getProjectDetails(projectId), 'Service project');
  const categories = await getAllCategories();
  const assignedCategories = await getCategoriesByProjectId(projectId);
  const formData = getFormData(req, { categoryIds: assignedCategories.map((category) => String(category.category_id)) });
  const selectedCategoryIds = Array.isArray(formData.categoryIds) ? formData.categoryIds : [];
  const title = 'Assign Categories to Project';
  res.render('assign-categories', { title, currentPath: '/projects', project, categories, selectedCategoryIds, formAction: req.path });
};

const processAssignCategoriesForm = async (req, res) => {
  const projectId = requireRecordId(req.params.projectId, 'Service project');
  requireRecord(await getProjectDetails(projectId), 'Service project');
  if (await redirectValidationErrors(req, res, ['categoryIds'])) return;
  const categoryIds = req.body.categoryIds;
  const categories = await getAllCategories();
  const availableIds = new Set(categories.map((category) => String(category.category_id)));
  if (!categoryIds.every((categoryId) => availableIds.has(categoryId))) {
    req.flash('error', 'Select existing categories. No assignments were changed.');
    rememberFormData(req, ['categoryIds']);
    await redirectWithSession(req, res, req.path);
    return;
  }
  try {
    await updateCategoryAssignments(projectId, categoryIds);
  } catch (error) {
    if (error.code !== '23503') throw error;
    req.flash('error', 'A selected category is no longer available. No assignments were changed.');
    rememberFormData(req, ['categoryIds']);
    await redirectWithSession(req, res, req.path);
    return;
  }
  req.flash('success', 'Categories updated successfully!');
  await redirectWithSession(req, res, `/project/${projectId}`);
};

export {
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
};
